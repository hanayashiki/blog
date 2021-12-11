import { h } from 'preact';
import { Blog } from '@models/Blog';
import Layout from '@components/Layout';
import StaticBoundary from '@components/StaticBoundary';
import Share from '@components/icons/Share';
import copy from 'copy-to-clipboard';

export default function Blog(props: { entry: Blog, prev?: Blog, next?: Blog, }) {
  const {
    entry,
    prev,
    next,
  } = props;

  const date = new Date(entry.data.date);

  const onShare = () => {
    copy(`${entry.data.title} https://blog.chenyu.pw/blogs/${entry.data.slug}`);
    alert('链接已经复制!')
  }

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

        <a onClick={onShare} className="text-gray-200 pl-4 hover:text-primary hover:cursor-pointer inline-block align-bottom <md:float-right">
          <Share fill="currentColor" size={20} />
        </a>
      </p>

      <StaticBoundary>
        <div class="md py-4" dangerouslySetInnerHTML={{ __html: entry.html! }} />
      </StaticBoundary>

      <div className="pt-4 pb-4 flex justify-center hover:cursor-pointer"> 
        <a onClick={onShare} className="text-gray-200 hover:text-primary">
          <Share fill="currentColor" size={20} />
        </a>
      </div>

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
