import { h } from 'preact';
import { Blog } from '@models/Blog';

function BlogEntry(props: { entry: Blog }) {
  const {
    entry,
  } = props;

  return (
    <div class="py-4">
      <h2 class="text-lg pt-2 pb-2 text-primary">
        {entry.data.title}
      </h2>
      <p class="text-sm pb-2 text-gray-300">
        {entry.data.date.getUTCFullYear()}
        -
        {entry.data.date.getUTCMonth() + 1}
        -
        {entry.data.date.getUTCDate()}
      </p>
      <p class="text-sm">
        {entry.data.abstract}
      </p> 
    </div>
  );
}

export default function(props: { entries: Blog[] }) {
  const {
    entries,
  } = props;

  return (
    <div class="p-4 bg-gray-900 min-h-screen">
      <main class="max-w-3xl mx-auto text-white">
        <div class="bg h-[512px] bg-bottom bg-cover bg-no-repeat" />

        <h1 class="text-center border-b-[1px] py-3 text-2xl">
          Chenyu's Blog
        </h1>

        {entries.map((entry, i) => (
          <BlogEntry key={i} entry={entry} />
        ))}
      </main>
    </div>
  );
}
