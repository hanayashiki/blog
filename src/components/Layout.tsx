import { h, ComponentChildren, Fragment } from "preact";
import { useState } from "preact/hooks";
import useRaf from "@libs/useRaf";
import { Github } from "./icons/Github";
import Telegram from "./icons/Telegram";
import { Plausible } from "./icons/Plausible";
import { Search } from "./icons/Search";

function Background() {
  useRaf();

  let scrollY = 0;
  if (typeof window !== "undefined") {
    scrollY = window.scrollY;
  }

  return (
    <div
      class="bg sm:h-[512px] h-[256px] bg-cover bg-no-repeat"
      style={{
        willChange: "transform",
        transform: `translateY(${scrollY / 4}px)`,
        backgroundPosition: "50% 60%",
      }}
    />
  );
}

export default function Layout(props: {
  currentYear?: string;
  years: string[];
  children: ComponentChildren;
  onToggleSearch?: () => void;
  isSearchVisible?: boolean;
}) {
  const { currentYear, years, children, onToggleSearch, isSearchVisible = true } = props;

  return (
    <div class="bg-gray-900 min-h-screen">
      <main class="max-w-3xl mx-auto text-white">
        <div style={{ overflow: "hidden" }}>
          <Background />
        </div>

        <div class="border-b-[1px] py-3 mx-3">
          <div class="flex items-center justify-between relative">
            <div class="w-10"></div> {/* Spacer to balance the layout */}
            <h1 class="text-2xl font-bold absolute left-1/2 transform -translate-x-1/2">
              <a href="/">Chenyu's Blog</a>
            </h1>
            <button 
              onClick={onToggleSearch} 
              class="p-1 rounded-full hover:bg-gray-700 transition-colors"
              aria-label={isSearchVisible ? "Hide search" : "Show search"}
            >
              <Search size={20} fill={isSearchVisible ? "white" : "#6366f1"} />
            </button>
          </div>
        </div>

        <div class="px-4">{children}</div>

        <div class="text-center font-thin mb-[1rem] text-sm">
          {years.map((y, i) => (
            <Fragment key={y}>
              <a
                href={`/${y}`}
                class={`${currentYear === y ? "text-primary" : ""}`}
              >
                {y}
              </a>

              {i < years.length - 1 && "・"}
            </Fragment>
          ))}
        </div>

        <div class="h-px bg-white mx-3" />

        <div class="flex flex-col py-8 mx-5 gap-y-4">
          <div class="flex flex-row justify-center text-primary text-sm gap-x-2">
            <a href="/" class="hover:text-white">
              Home
            </a>
            ·
            <a href="/me" class="hover:text-white">
              Me
            </a>
            ·
            <a href="/privacy" class="hover:text-white">
              Privacy
            </a>
            ·
            <a
              href="https://github.com/hanayashiki/blog"
              aria-label="Source Code on GitHub"
              target="_blank"
              rel="noreferrer"
              class="hover:text-white"
            >
              Source
            </a>
          </div>
          <div class="flex flex-row justify-center gap-x-4">
            <a
              href="https://t.me/chenyusblog"
              aria-label="Telegram"
              target="_blank"
              rel="noreferrer"
              class="text-gray-300 hover:text-primary"
            >
              <Telegram fill="currentColor" />
            </a>
            <a
              href="https://github.com/hanayashiki"
              aria-label="GitHub"
              target="_blank"
              rel="noreferrer"
              class="text-gray-300 hover:text-primary"
            >
              <Github fill="currentColor" />
            </a>
            <a
              href="https://plausible.monoid.co.jp/blog.chenyu.pw"
              aria-label="Analytics with Plausible"
              target="_blank"
              rel="noreferrer"
              class="text-gray-300 hover:text-primary"
            >
              <Plausible fill="currentColor" />
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
