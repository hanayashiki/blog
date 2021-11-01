---
title: Strictly type a NextJS Page
slug: basic-problems-with-react
date: 2021-01-06
abstract: Next.js does not provide very good documentation for typing a page. Here is what I found by wandering around google.
---

The corresponding Nextjs documentation is [here](https://nextjs.org/learn/excel/typescript/nextjs-types)

```
import Layout from '../../components/layout'
import Head from 'next/head'
import { getAllPostIds, getPostData, PostEntry } from '../../lib/posts'
import { GetStaticProps, GetStaticPaths } from 'next'
import { ParsedUrlQuery } from 'querystring';

export interface PostProps {
    postData: PostEntry   
}

export interface PostStaticParams extends ParsedUrlQuery {
    id: string;
}

export default function PostPage({ postData }: PostProps) {
    return (
        <Layout>
            <Head>
                <title>First Post</title>
            </Head>
            {postData.title}
            <br />
            {postData.id}
            <br />
            {postData.date}
        </Layout>
    );
}

export const getStaticPaths: GetStaticPaths<PostStaticParams> = async (context) => {
    // Return a list of possible value for id
    const paths = getAllPostIds()
    return {
        paths,
        fallback: false
    }
}

export const getStaticProps: GetStaticProps<PostProps, PostStaticParams> = async (context) => {
    const { params } = context;
    const postData = getPostData(params.id)
    return {
        props: {
            postData
        }
    }
}
```

Here are two key types we need to check, simply `PostProps` and `PostStaticParams`.

`PostProps` is the actual props we want to pass to our rendering page. 

`PostStaticParams` is the params given when such page is generated. Typically, it contains the id of the requested resource.

Now we can correctly induce the type of the only parameter `context` in `getStaticProps` or `getStaticPaths` w/o boilerplates.
