import { h } from 'preact';
import { Blog } from '@models/Blog';
import Layout from '@components/Layout';

function BlogEntry(props: { entry: Blog }) {
  const {
    entry,
  } = props;

  const date = new Date(entry.data.date);

  return (
    <div class="py-4">
      <a href={`/blogs/${entry.data.slug}`}>
        <h2
          class="text-lg pt-2 pb-2 text-primary hover:cursor-pointer transform hover:-translate-y-0.5 transition-transform"
        >
          {entry.data.title}
        </h2>
      </a>
      <p class="text-sm pb-2 text-gray-300">
        {date.getUTCFullYear()}
        -
        {date.getUTCMonth() + 1}
        -
        {date.getUTCDate()}
      </p>
      <p class="text-sm">
        {entry.data.abstract}
      </p>
    </div>
  );
}

export default function HomePage(props: { entries: Blog[] }) {
  const {
    entries,
  } = props;

  return (
    <Layout>
      {entries.map((entry, i) => (
        <BlogEntry key={i} entry={entry} />
      ))}
    </Layout>
  );
}
 