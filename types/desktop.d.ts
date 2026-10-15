declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
  export function installStyles(ctx: { effect(callback: () => () => void, label?: string): unknown }): void
}

declare module '@deepseek-ai/cordis' {
  export type Context = import('../src/client/desktop-context.ts').DesktopContext
}
