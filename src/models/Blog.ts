export interface Blog {
  data: {
    title: string;
    slug: string;
    date: Date;
    abstract: string;
  },
  content?: string;
}
