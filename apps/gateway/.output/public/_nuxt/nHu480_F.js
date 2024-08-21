import {
  G as d,
  F as f,
  J as h,
  I as i,
  H as l,
  K as m,
  E as o,
  r as u,
  e as v,
} from "./C6uzYG6W.js";

function U(t, a = {}) {
  const e = a.head || o();
  if (e) return e.ssr ? e.push(t, a) : p(e, t, a);
}
function p(t, a, e = {}) {
  const s = u(!1),
    n = u({});
  f(() => {
    n.value = s.value ? {} : h(a);
  });
  const r = t.push(n.value, e);
  return (
    d(n, (c) => {
      r.patch(c);
    }),
    m() &&
      (v(() => {
        r.dispose();
      }),
      l(() => {
        s.value = !0;
      }),
      i(() => {
        s.value = !1;
      })),
    r
  );
}
export { U as u };
