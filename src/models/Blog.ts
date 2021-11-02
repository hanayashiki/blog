export interface Blog {
  data: {
    title: string;
    slug: string;
    date: Date | string;
    abstract: string;
  },
  content?: string;
  html?: string;
}
