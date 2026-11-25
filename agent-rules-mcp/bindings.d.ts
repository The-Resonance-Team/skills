type RulesBindings = import('./src/types').Env;

declare namespace Cloudflare {
  interface GlobalProps {
    mainModule: typeof import('./src/index');
    durableNamespaces: 'ApprovalStore';
  }
  interface Env extends RulesBindings {}
}
