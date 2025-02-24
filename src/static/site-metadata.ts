interface ISiteMetadataResult {
  siteTitle: string;
  siteUrl: string;
  description: string;
  logo: string;
  navLinks: {
    name: string;
    url: string;
  }[];
}

const data: ISiteMetadataResult = {
  siteTitle: 'GaoHao\'s Running Page',
  siteUrl: 'https://efish2002.github.io/running_page/',
  logo: 'https://avatars.githubusercontent.com/u/10509616?v=4',
  description: 'Personal site and blog',
  navLinks: [
    {
      name: 'Blog',
      url: 'https://github.com/efish2002/running_page/wiki',
    },
    {
      name: 'About',
      url: 'https://github.com/efish2002/running_page/blob/master/README-CN.md',
    },
  ],
};

export default data;
