### Introduction

This POC seeks to make a deeper exploration into building a shared components library, simplifying the initial setup of the project by utilizing Vite's library mode (which includes Rollup as the bundler) but attempting to dive deeper into adding styles to components

This library needs to fulfill the following requirements:

- Should be in Typescript
- Should be Tree-shakable (i.e should only include the necessary code you need per import)
- Imports only the styles that you need (foreshadowing that this point and the next are not easy problems to solve)
- Should be compatible with nextjs 14

### Setting up Vite in Library mode 

[Most of the information comes from this guide](https://dev.to/receter/how-to-create-a-react-component-library-using-vites-library-mode-4lma)

 
1. Run the following in a new directory, selecting React and TypeScript as our framework and variant options respectively.

```
npm create vite@latest
```

2. We can consider all code in the `src` folder as our demo page. we will place our component code in a dir called `lib`. In this dir, we will create the entry point of our library as a file called `main.ts`:

![image](https://github.com/user-attachments/assets/44d76317-f1d2-4bf2-b4c8-c2573187062c)


3. We only wish to transpile and ship the code inside of `lib` and not in `src`. So we can activate Library Mode in Vite by adding this to our `vite.config.ts` file:
```
import { resolve } from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "lib/main.ts"),
      name: "vite_components_lib",
      fileName: (format) => `vite-components-lib.${format}.js`,
      formats: ["es"],
    },
```

[for more info on Library mode](https://vitejs.dev/guide/build.html#library-mode)

4. To enable Typescript for library mode, you’ll need to add our `lib` dir to the include options in `tsconfig.json` file:

```
  - "include": ["src"]
  + "include": ["src", "lib"],
```

However, when we import our components from the `dist` folder, we’ll get a ts error as we’ll be importing a component that has not yet been built. We’ll have to exclude the `src` folder when building the library by creating a separate config file for building.
Create another file, `tsconfig-build.json` in the same dir level as `tsconfig.json`

```
{
  "extends": "./tsconfig.json",
  "include": ["lib"]
}
```

Then update our `package.json` to pass our build config file to `tsc`:

```
  "scripts": {
    "build": "tsc --p ./tsconfig-build.json && vite build",
  ...
}
```

we’ll also need to copy the `vite-env.d.ts` file in `/src` into `/lib` as if we don’t, typescript might miss some types definitions provided by vite when building. 

Build our project by running:

```
npm run build
```

if you don’t wish to include the files in the public folder, add this option to `vite.config.ts`:

```
  build: {
    copyPublicDir: false,
  ...
}
```

 Add your components to the lib file! don’t forget export it in `main.ts`:

in `main.ts`
```
export { Button } from "./components/Button";
```

Config Rollup to exclude react:

```
// vite.config.ts
rollupOptions: {
      // add jsx-runtime for react 17
      external: ["react", "react-dom", "react/jsx-runtime"],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },

        },
```

### Styles

There are a few methods we can use to add styles to our component library:

  1. CSS stylesheets
    Each  component will have its corresponding CSS file, and consumers of the library need to import these stylesheets separately.

       - Pros: Simple, familiar to most developers, easy to override.
       - Cons: Global scope by default, no dynamic styling based on props. (see here for globalscope issues with next: 

  2. CSS modules (.module.css…)

      - Pros: Locally scoped styles, prevent class name collisions.
      - Cons: Less dynamic, consumers might need specific build configurations.

  3. In-line CSS
    `<button style={{color: #FFF, ...}}`

     - Pros: Simple, no additional setup.
     - Cons: Limited functionality, no media queries or pseudo-classes, harder to manage for complex styles.

  4. CSS-In-JS
    Libraries like styled-components or emotion allow you to write CSS directly in your JavaScript. This approach is very powerful for dynamic styling based on props and can support theming easily.

     - Pros: Dynamic styling, scoped styles, theme support.
     - Cons: May add to the bundle size, different syntax to learn.


For the purposes of this POC, I will be using CSS modules (no dependency on the css-in-js libraries)

### The problem with (some) CSS

Using either .css stylesheets or CSS modules on build will generate 1 style.css file.

![image](https://github.com/user-attachments/assets/51eed603-4569-4d41-9975-78182f5ea138)

  - this file contains all the styles, for all the components.
  - we will need to import the file in the consuming application, which breaks the requirement of importing only the code that you need!
  - [check out this long discussion on github about injecting css in js](https://github.com/vitejs/vite/issues/1579)

     
[We will use a vite plugin](https://github.com/emosheeep/fe-tools/tree/master/packages/vite-plugin-lib-inject-css) to inject the relevant styles and then perform one last step according to the author of the plugin:

> The last and most important, add all of the entry files you’ve exported in main.js to your rollup.input configurations.

```
// vite.config.ts
import { extname, relative, resolve } from "path";
import { glob } from "glob";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { libInjectCss } from "vite-plugin-lib-inject-css";
import dts from "vite-plugin-dts";

export default defineConfig({
  // ship type definitions with our package using vite-plugin-dts
  plugins: [react(), libInjectCss(), dts({ include: ["lib"] })],
  build: {
    copyPublicDir: false,
    lib: {
      entry: resolve(__dirname, "lib/main.ts"),
      name: "vite_components_lib",
      formats: ["es"],
    },
    rollupOptions: {
      // add jsx-runtime for react 17
      external: ["react", "react-dom", "react/jsx-runtime"],
      input: Object.fromEntries(
        glob
          .sync("lib/**/*.{ts,tsx}")
          .map((file) => [
            relative("lib", file.slice(0, file.length - extname(file).length)),
            fileURLToPath(new URL(file, import.meta.url)),
          ])
      ),
    // This code for the output places all the generated css files into an assets folder, purely aesthetic
      output: {
        assetFileNames: "assets/[name][extname]",
        entryFileNames: "[name].js",
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
        },
      },
    },
  },
});
```

Lastly, we need to add sideEffects to the `package.json` to prevent the css file from being tree shaken out:
```
{
  "name": "component-lib",
  "version": "1.0.0",
  "main": "dist/index.mjs",
  "sideEffects": [
    "**/*.css"
  ]
}
```

### Finishing up

We’ll just have to update our `package.json` for publishing by setting the entry point, defining the files to publish and updating the `dependencies` to `peerDependencies`. your `package.json` should look like this:

```
{
  "name": "@<WORKSPACE>/<LIBRARY NAME>",
  "repository": "git@github.com:<WORKSPACE>/<LIBRARY NAME>.git",
  "version": "0.0.1",
  "type": "module",
  "main": "dist/main.js",
  "types": "dist/main.d.ts",
  "files": [
    "dist"
  ],
// adding publish config here means your .npmrc file only needs to keep the personal access token only
  "publishConfig": {
    "registry": "https://npm.pkg.github.com/"
  },
  "scripts": {
    "dev": "vite",
    "build": "tsc --p ./tsconfig-build.json && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview"
  },
  "peerDependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.8.10",
    "@types/react": "^18.2.15",
    "@types/react-dom": "^18.2.7",
    "@typescript-eslint/eslint-plugin": "^6.0.0",
    "@typescript-eslint/parser": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.3",
    "eslint": "^8.45.0",
    "eslint-plugin-react-hooks": "^4.6.0",
    "eslint-plugin-react-refresh": "^0.4.3",
    "glob": "^10.3.10",
    "typescript": "^5.0.2",
    "vite": "^4.4.5",
    "vite-plugin-dts": "^3.6.3",
    "vite-plugin-lib-inject-css": "^1.3.0"
  },
  "sideEffects": [
    "**/*.css"
  ]
}
```

and then just follow github’s guide on publishing the package to github npm registry:
 

