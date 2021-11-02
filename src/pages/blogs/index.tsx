import { h } from 'preact';
import { Blog } from '@models/Blog';
import Layout from '@components/Layout';
import StaticBoundary from '@components/StaticBoundary';

export default function Blog(props: { entry: Blog, prev?: Blog, next?: Blog, }) {
  const {
    entry,
    prev,
    next,
  } = props;

  const date = new Date(entry.data.date);

  return (
    <Layout>
      <h2 class="text-3xl py-4 text-primary leading-relaxed">
        {entry.data.title}
      </h2>

      <p class="text-sm pb-2 text-gray-300">
        {date.getUTCFullYear()}
        -
        {date.getUTCMonth() + 1}
        -
        {date.getUTCDate()}
      </p>

      <StaticBoundary>
        <div class="md py-4" dangerouslySetInnerHTML={{ __html: entry.html! }} />
      </StaticBoundary>

      <div class="flex justify-between md:justify-start gap-x-2">
        {prev ? (
          <a class="text-primary hover:text-white" href={`/blogs/${prev.data.slug}`}>
            Previous
          </a>
        ) : (
          <span />
        )}

        {next ? (
          <a class="text-primary hover:text-white" href={`/blogs/${next.data.slug}`}>
            Next
          </a>
        ) : (
          <span />
        )}
      </div>
    </Layout>
  );
}
