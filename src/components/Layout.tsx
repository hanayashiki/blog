import { h, ComponentChildren } from 'preact';
import useRaf from '@libs/useRaf';
import { Github } from './icons/Github';
import Telegram from './icons/Telegram';
import { Plausible } from './icons/Plausible';

function Background() {
  useRaf();

  let scrollY = 0;
  if (typeof window !== 'undefined') {
    scrollY = window.scrollY;
  }

  return (
    <div
      class="bg sm:h-[512px] h-[256px] bg-bottom bg-cover bg-no-repeat"
      style={{
        willChange: 'transform',
        transform: `translateY(${scrollY / 4}px)`,
      }}
    />
  );
}

export default function Layout(props: { children: ComponentChildren }) {
  const {
    children,
  } = props;

  return (
    <div class="bg-gray-900 min-h-screen">
      <main class="max-w-3xl mx-auto text-white">
        <div style={{ overflow: 'hidden' }}>
          <Background />
        </div>

        <a href="/">
          <h1 class="text-center border-b-[1px] py-3 text-2xl mx-3">
            Chenyu's Blog
          </h1>
        </a>

        <div class="p-4">
          {children}
        </div>

        <div class="h-px bg-white mx-3" />

        <div class="flex flex-col py-8 mx-5 gap-y-8">
          <div class="flex flex-row justify-center gap-x-4">
            <a href="https://t.me/chenyusblog" aria-label="Telegram" target="_blank" rel="noreferrer" class="text-gray-300 hover:text-primary">
              <Telegram fill="currentColor" />
            </a>
            <a href="https://github.com/hanayashiki" aria-label="GitHub" target="_blank" rel="noreferrer" class="text-gray-300 hover:text-primary">
              <Github fill="currentColor" />
            </a>
            <a href="https://plausible.monoid.co.jp/blog.chenyu.pw" aria-label="Analytics with Plausible" target="_blank" rel="noreferrer" class="text-gray-300 hover:text-primary">
              <Plausible fill="currentColor" />
            </a>
          </div>
        </div>
      </main>
    </div>
  )
}
