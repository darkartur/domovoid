import type { RcFile } from "syncpack";

export default {
  semverGroups: [
    {
      label: "devDependencies use ^ ranges",
      range: "^",
      dependencyTypes: ["dev"],
      dependencies: ["**"],
      packages: ["**"],
    },
  ],
} satisfies RcFile;
