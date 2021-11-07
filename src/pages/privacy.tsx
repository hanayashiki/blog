import { h } from 'preact';
import { Blog } from '@models/Blog';
import Layout from '@components/Layout';

export default function Privacy() {
  return (
    <Layout>
      <div className="me px-4 font-light leading-loose">
        <h2 className="font-bold text-xl my-8">
          Privacy
        </h2>

        The site itself, hosted at blog.chenyu.pw, does not collect any data, since I don't have the control to the hosting server.
        <br />
        It is hosted on <a class="link-primary" href="https://vercel.com/">vercel.com</a>,
        {' '}
        so your data would be subject to their Privacy Policy.
        <br />
        <br />

        I also host with the open source analytics tool <a class="link-primary" href="https://plausible.io">Plausible</a>
        {' '}
        to get the aggregational data of traffic, so the data I collect is the same as <a class="link-primary" href="https://plausible.io">Plausible</a> states in their Privacy Policy.
        <br />
        <br />
        <b>
          I do not collect any personal identifiable data.
        </b>
        {' '}
        You may check the <a class="link-primary" href="https://plausible.monoid.co.jp/blog.chenyu.pw">Plausbile Dashboard</a>
        {' '}
        to view the public traffic and know what data I'm collecting.
        <br />
        <br />
        2021-11-05
      </div>
    </Layout>
  );
}
