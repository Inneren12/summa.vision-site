"use client";
import React from "react";

import { FLAG_REGISTRY, knownFlags } from "../../lib/ff/flags";
import { readOverridesFromCookieHeader, type Overrides } from "../../lib/ff/overrides";
import { useFlags } from "../FlagsProvider";

function buildOverrideHref(pair: string) {
  return `/api/ff-override?ff=${encodeURIComponent(pair)}`;
}

export default function DevFlagsPage() {
  const flags = useFlags();
  let overrides: Overrides = {};
  if (typeof document !== "undefined") {
    overrides = readOverridesFromCookieHeader(document.cookie);
  }
  const rows = knownFlags().map((name) => {
    const meta = FLAG_REGISTRY[name];
    const value = flags[name];
    const overridden = Object.prototype.hasOwnProperty.call(overrides, name);
    return (
      <tr key={name}>
        <td>
          <code>{name}</code>
        </td>
        <td>{meta.type}</td>
        <td>{String(value)}</td>
        <td>{overridden ? "override" : "env/default"}</td>
        <td style={{ display: "flex", gap: 8 }}>
          <a href={buildOverrideHref(`${name}:true`)}>ON</a>
          <a href={buildOverrideHref(`${name}:false`)}>OFF</a>
          <a href={buildOverrideHref(`${name}:null`)}>Reset</a>
        </td>
      </tr>
    );
  });
  return (
    <main style={{ padding: 16 }}>
      <h1>Dev Flags</h1>
      <p>
        Overrides are stored in <code>sv_flags_override</code> cookie for ~1 hour.
      </p>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Value</th>
            <th>Source</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </main>
  );
}
