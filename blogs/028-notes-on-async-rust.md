---
title: Async Rust Notes
slug: notes-on-async-rust
date: 2024-11-30
abstract: ALERT! Reading this might be a waste of time for unfamiliar readers because only the key points are noted here.
---

# The Future Trait

```rs
pub trait Future {
    type Output;

    fn poll(self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Self::Output>;
}
```

1. Why `Pin<&mut Self>`

   1. What is pinning?
      1. [Reference](https://doc.rust-lang.org/std/pin/)
      2. Moving: Copying the bytes of one value from one location to another.
      3. Unpinned by default: Rust compiler is (or we are) allowed to move the values by default.
      4. Pinning: We say that a value has been pinned when it has been put into a state where it is guaranteed to remain located at the same place in memory **from** the time it is _pinned_ **until** its _drop_ is called.
   2. What does `Pin<Ptr>` mean?

      ```rs
      #[derive(Copy, Clone)]
      pub struct Pin<Ptr> {
         pub __pointer: Ptr,
      }

      impl<Ptr: Deref> Pin<Ptr> { ... }
      ```

      1. Pinning is a promise that we will not move the value of type `Self` once `Pin<&mut Self>` is constructed, before the value is dropped (instead of `Pin<...>` is dropped).
      2. Pinning does not change the behavior of the compiler. However, it prevents misuse in the safe code.
      3. Pinning is a contract with the unsafe code.
      4. There is no constraint to forbid moving the value, if you have a mutable reference it somewhere else! So one of the safe way to do construct a `Pin<&mut Self>` is to move the value inside the `Pin`, e.g. using `Box::pin(value)`. The `Self` owning `Pin<Box<Self>>` returned ensure that `Self` is not moved anymore.
      5. Having a mutable reference elsewhere to the `Pin` is source of unsafety (even after `Pin<&mut Self>` is dropped! Remember once the value is pinned it is up to you to uphold the constraint forever, so getting a mutable reference is after dropping `Pin<&mut Self>` can elide the check of the borrow checker and break the promise).

   3. `Pin<&mut Self>` prevents misuse in safe code

      1. `Pin<&mut Self>` disallows getting `&mut Self where Self: !Unpin` in safe code.
         1. Mark your `Self` with a field of `std::marker::PhantomPinned`
            ```rs
            #[derive(Default)]
            struct AddrTracker {
               prev_addr: Option<usize>,
               // remove auto-implemented `Unpin` bound to mark this type as having some
               // address-sensitive state. This is essential for our expected pinning
               // guarantees to work, and is discussed more below.
               _pin: PhantomPinned,
            }
            ```
         2. Getting `&mut Self` must be unsafe
            ```rs
            impl AddrTracker {
               fn check_for_move(self: Pin<&mut Self>) {
                  let current_addr = &*self as *const Self as usize;
                  match self.prev_addr {
                        None => {
                           // SAFETY: we do not move out of self
                           let self_data_mut = unsafe { self.get_unchecked_mut() };
                           self_data_mut.prev_addr = Some(current_addr);
                        },
                        Some(prev_addr) => assert_eq!(prev_addr, current_addr),
                  }
               }
            }
            ```
      2. See: https://doc.rust-lang.org/std/pin/#fixing-addrtracker
      3. See reasons why constructing `Pin<&mut Self>` is unsafe:
         1. https://doc.rust-lang.org/std/pin/struct.Pin.html#method.new_unchecked

   4. Miscs

      1. `fn check_for_move(self: Pin<&mut Self>)` vs `fn check_for_move(mut self: Pin<&mut Self>)`

         1. Note the `mut` placed before self
         2. However, there are basically no difference because
            1. Nothing inside `self: Pin<&mut Self>` can be mutated (`__pointer` field is not mutable for users, either).
            2. Methods like `get_unchecked_mut`, `map_unchecked_mut` moves `self` out thus not requiring `mut self` as input.
            3. `mut self` and `self` actually means you will consume `self` so the `mut` does not matter to the caller anyways.
         3. Here `self` is nothing but a value of type `Pin<&mut Self>`, just like any other parameters.
         4. Both `self` and `mut self` _allows_ getting mut in unsafe code.

            ```rs
            struct S {
               x: i32,
               _pin: PhantomPinned,
            }

            impl S {
               fn immutable_self(self: Pin<&mut Self>) {
                  unsafe {
                     self.get_unchecked_mut().x = 1;
                  }
               }

               fn mut_self(mut self: Pin<&mut Self>) {
                  //       ^ Warning: variable does not need to be mutable
                  unsafe {
                     self.get_unchecked_mut().x = 1;
                  }
               }
            }
            ```

         5. `mut self` appears in some tutorials but I think it is not required.

   5. So, why does `Future` needs `self: Pin<&mut Self>` instead of `&mut self`?

      1. It is answered many times. See: https://rust-lang.github.io/async-book/04_pinning/01_chapter.html#why-pinning
      2. TLDR:

         1. `Future`, since desugared from your code, contains self-reference just like your sync code.

            ```rs
            let a = 1;
            let ref_a = &a; // `ref_a` is desugared to be a field in your returned `Future`, thus self-referencing.
            do_something().await;

            println("a = ", *ref_a);
            ```

         2. Self-referencing is safe in sync code because the stack does not move.
         3. Self-referencing is unsafe (if we don't use `Pin`) because `Future` are stored in heaps and Rust doesn't forbid moving heap-allocated values.
         4. `Pin` means `Self` is pinned at least before we entered our self-referencing code, thus it is safe now to `ref_a = &a`

# The Arc Pointer

Arc is short for "Atomically Reference Counted"

1. `Arc<T>` uses atomic operation for RC

2. `T` must be immutable.

3. `Arc<T>` is `Send` if `T` is `Send + Sync`, and `Arc<T>` is `Sync` if `T` is `Send + Sync`.

   1. This means if `T` is not `Sync` or not `Send`, `Arc<T>` becomes neither `Send` or `Sync` (meaning `Arc<T>` is not only not `Sync` but also not `Send`, therefore not more useful than `Rc<T>`)

      ```rs
      use std::{cell::Cell, sync::Arc};

      struct S {
         cell: Cell<i32>,
      }

      fn shit() {
         let arc_s = Arc::new(S { cell: Cell::new(0) });

         fn is_sync<T: Sync>(t: T) {}

         fn is_send<T: Send>(t: T) {}

         is_send(arc_s);
         //      ^ `Cell<i32>` cannot be shared between threads safely...
      }
      ```

   2. This can be understood like, if we want to access `T` from `Arc<T>` from different threads, we must expect `T` to support multi-threading as good as `Arc`'s ref counter. To prove it more rigidly, we consider:

      1. If `T` is not `Sync`,

         1. We assume `Arc<T>` is `Send`, consider the following case:

            ```rs
            let a = Arc::new(S {});
            let b = a.clone();

            thread::spawn(move || {
               // `b` is sent here
               b
            });
            thread::spawn(move || {
               // `a` is sent here
               a
            });
            ```

            This is not safe, because `b` and `a` are handled by different thread, manipulating the same `T: !Sync`.
            So `Arc<T>` cannot be `Send`.

         2. We assume `Arc<T>` is `Sync`. That means `&Arc<T>` (which produces `&T`) can be shared among threads, but `T` cannot be shared since `T: !Sync`.

      2. If `T` is not `Send`,
         1. See: https://stackoverflow.com/questions/41909811/why-does-arct-require-t-to-be-both-send-and-sync-in-order-to-be-send
         2. TDLR: `Arc<T>` might move the underlying `T` among threads in the following situations:
            1. `drop`
            2. [`try_unwrap`](https://doc.rust-lang.org/std/sync/struct.Arc.html#method.try_unwrap)

4. Notes of using `Arc<T>`:
   1. `Arc<T>` does not powers you with `Send + Sync + 'static` (which is generally desired in async Rust). You need to ensure T is `Send + Sync + 'static` by iteself.
   2. `Arc<T>` is generally used to hold "injected services" into your APIs.
   3. A plain static' `T` is not really useful, since services cannot stay bitwise the same shared by all threads. For example, if you are using a db service, it needs to maintain a mutating connection pool while providing a `&self` interface. Actually the frameworks only allow us to have `&self` access to the context, so the handlign of interior mutability is on our own.
