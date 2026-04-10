// CSS and static asset type declarations for Next.js
declare module "*.css" {
  export {};
}

declare module "*.scss" {
  export {};
}

declare module "*.sass" {
  export {};
}

declare module "*.module.css" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.module.scss" {
  const classes: { [key: string]: string };
  export default classes;
}

declare module "*.module.sass" {
  const classes: { [key: string]: string };
  export default classes;
}
