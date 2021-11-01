import { h } from 'preact';
import { Blog } from '@models/Blog';
import Layout from '@components/Layout';

export default function (props: { entry: Blog, prev?: Blog, next?: Blog, }) {
  const {
    entry,
    prev,
    next,
  } = props;

  return (
    <Layout>
      <h2 class="text-3xl py-4 text-primary leading-relaxed">
        {entry.data.title}
      </h2>

      <p class="text-sm pb-2 text-gray-300">
        {entry.data.date.getUTCFullYear()}
        -
        {entry.data.date.getUTCMonth() + 1}
        -
        {entry.data.date.getUTCDate()}
      </p>

      <div class="md py-4" dangerouslySetInnerHTML={{ __html: entry.html! }} />

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
