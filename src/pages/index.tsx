import { h } from 'preact';
import { Blog } from '@models/Blog';
import Layout from '@components/Layout';
import Share from '@components/icons/Share';
import copy from 'copy-to-clipboard';

function BlogEntry(props: { entry: Blog }) {
  const {
    entry,
  } = props;

  const date = new Date(entry.data.date);

  const onShare = () => {
    copy(`${entry.data.title} https://blog.chenyu.pw/blogs/${entry.data.slug}`);
    alert('链接已经复制!')
  }

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

      <div className="pt-4"> 
        <a onClick={onShare} className="text-gray-500 hover:text-primary hover:cursor-pointer">
          <Share fill="currentColor" size={18} />
        </a>
      </div>
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
 