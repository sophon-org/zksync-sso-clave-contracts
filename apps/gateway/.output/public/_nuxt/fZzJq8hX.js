import {
  a as A,
  d as b,
  ae as B,
  aj as C,
  v as D,
  a4 as E,
  T as F,
  _ as G,
  a9 as H,
  ah as I,
  aa as j,
  x as J,
  ac as k,
  ai as L,
  z as M,
  r as N,
  u as O,
  al as q,
  t as Q,
  ag as R,
  G as S,
  ad as T,
  h as u,
  ak as V,
  S as w,
  ab as x,
  af as y,
  am as z,
} from "./C6uzYG6W.js";

const U = b({
    props: {
      vnode: { type: Object, required: !0 },
      route: { type: Object, required: !0 },
      vnodeRef: Object,
      renderKey: String,
      trackRootNodes: Boolean,
    },
    setup(e) {
      const o = e.renderKey,
        a = e.route,
        r = {};
      for (const n in e.route)
        Object.defineProperty(r, n, {
          get: () => (o === e.renderKey ? e.route[n] : a[n]),
        });
      return H(x, j(r)), () => u(e.vnode, { ref: e.vnodeRef });
    },
  }),
  W = b({
    name: "NuxtPage",
    inheritAttrs: !1,
    props: {
      name: { type: String },
      transition: { type: [Boolean, Object], default: void 0 },
      keepalive: { type: [Boolean, Object], default: void 0 },
      route: { type: Object },
      pageKey: { type: [Function, String], default: null },
    },
    setup(e, { attrs: o, slots: a, expose: r }) {
      const n = A(),
        i = N(),
        s = k(x, null);
      let l;
      r({ pageRef: i });
      const d = k(B, null);
      let c;
      const g = n.deferHydration();
      if (n.isHydrating) {
        const t = n.hooks.hookOnce("app:error", g);
        O().beforeEach(t);
      }
      return (
        e.pageKey &&
          S(
            () => e.pageKey,
            (t, m) => {
              t !== m && n.callHook("page:loading:start");
            },
          ),
        () =>
          u(
            T,
            { name: e.name, route: e.route, ...o },
            {
              default: (t) => {
                const m = Y(s, t.route, t.Component),
                  h = s && s.matched.length === t.route.matched.length;
                if (!t.Component) {
                  if (c && !h) return c;
                  g();
                  return;
                }
                if (c && d && !d.isCurrent(t.route)) return c;
                if (m && s && (!d || (d != null && d.isCurrent(s))))
                  return h ? c : null;
                const f = y(t, e.pageKey);
                !n.isHydrating &&
                  !Z(s, t.route, t.Component) &&
                  l === f &&
                  n.callHook("page:loading:end"),
                  (l = f);
                const v = !!(e.transition ?? t.route.meta.pageTransition ?? R),
                  K =
                    v &&
                    X(
                      [
                        e.transition,
                        t.route.meta.pageTransition,
                        R,
                        {
                          onAfterLeave: () => {
                            n.callHook("page:transition:finish", t.Component);
                          },
                        },
                      ].filter(Boolean),
                    ),
                  p = e.keepalive ?? t.route.meta.keepalive ?? I;
                return (
                  (c = L(
                    F,
                    v && K,
                    C(
                      p,
                      u(
                        V,
                        {
                          suspensible: !0,
                          onPending: () =>
                            n.callHook("page:start", t.Component),
                          onResolve: () => {
                            w(() =>
                              n
                                .callHook("page:finish", t.Component)
                                .then(() => n.callHook("page:loading:end"))
                                .finally(g),
                            );
                          },
                        },
                        {
                          default: () => {
                            const _ = u(U, {
                              key: f || void 0,
                              vnode: a.default
                                ? u(E, void 0, a.default(t))
                                : t.Component,
                              route: t.route,
                              renderKey: f || void 0,
                              trackRootNodes: v,
                              vnodeRef: i,
                            });
                            return (
                              p &&
                                (_.type.name =
                                  t.Component.type.name ||
                                  t.Component.type.__name ||
                                  "RouteProvider"),
                              _
                            );
                          },
                        },
                      ),
                    ),
                  ).default()),
                  c
                );
              },
            },
          )
      );
    },
  });
function X(e) {
  const o = e.map((a) => ({
    ...a,
    onAfterLeave: a.onAfterLeave ? q(a.onAfterLeave) : void 0,
  }));
  return z(...o);
}
function Y(e, o, a) {
  if (!e) return !1;
  const r = o.matched.findIndex((n) => {
    let i;
    return (
      ((i = n.components) == null ? void 0 : i.default) ===
      (a == null ? void 0 : a.type)
    );
  });
  return !r || r === -1
    ? !1
    : o.matched.slice(0, r).some((n, i) => {
        let s, l, d;
        return (
          ((s = n.components) == null ? void 0 : s.default) !==
          ((d = (l = e.matched[i]) == null ? void 0 : l.components) == null
            ? void 0
            : d.default)
        );
      }) ||
        (a && y({ route: o, Component: a }) !== y({ route: e, Component: a }));
}
function Z(e, o, a) {
  return e
    ? o.matched.findIndex((n) => {
        let i;
        return (
          ((i = n.components) == null ? void 0 : i.default) ===
          (a == null ? void 0 : a.type)
        );
      }) <
        o.matched.length - 1
    : !1;
}
const $ = {},
  P = { class: "app-layout" },
  ee = { class: "app-layout-main" };
function te(e, o) {
  const a = W;
  return Q(), D("div", P, [J("main", ee, [M(a)])]);
}
const ne = G($, [
  ["render", te],
  ["__scopeId", "data-v-b27ba3b0"],
]);
export { ne as default };
