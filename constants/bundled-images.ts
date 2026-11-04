export const bundledImages = ["ocean", "forest", "dusk"].map((name) => ({
  id: `bundled-${name}`,
  urls: {
    thumb: `/backgrounds/${name}.svg`,
    full: `/backgrounds/${name}.svg`,
  },
  links: { html: `/backgrounds/${name}.svg` },
  user: { name: "Cardigan" },
}));
