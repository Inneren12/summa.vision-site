"use client";

import { useEffect, useState } from "react";

type FlagMeta = {
  name: string;
  type: "boolean" | "string" | "number" | "rollout" | "variant";
  description?: string;
  deprecated?: boolean;
  ignoreOverrides?: boolean;
  variants?: string[];
};

type Props = {
  baseUrl: string;
  registry: FlagMeta[];
  serverFlags: Record<string, boolean | string | number>; // эффективные значения на сервере
  overridesJson?: string; // содержимое cookie sv_flags_override (если есть)
  stableId: string;
};

function buildOverrideCurl(baseUrl: string, name: string, value: boolean | string | number | null) {
  // ff param в формате key:JSON.stringify(value)
  const v = value === null ? "null" : JSON.stringify(value);
  const qp = encodeURIComponent(`${name}:${v}`);
  return `curl -i "${baseUrl}/api/ff-override?ff=${qp}"`;
}

export default function DevFlagsClient({
  baseUrl,
  registry,
  serverFlags,
  overridesJson,
  stableId,
}: Props) {
  const [sid, setSid] = useState(stableId);
  const [selectedFlag, setSelectedFlag] = useState<string>(() => {
    const rollout = registry.find((r) => r.type === "rollout");
    return rollout?.name ?? registry[0]?.name ?? "";
  });
  const [preview, setPreview] = useState<{
    enabled: boolean;
    percent: number;
    salt: string;
    inRollout: boolean;
  } | null>(null);
  async function api(path: string, init?: RequestInit) {
    const res = await fetch(path, init);
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`${res.status} ${res.statusText}: ${text}`);
    }
    return res.json().catch(() => ({}));
  }

  async function setSvId(next?: string) {
    const url = new URL("/api/dev/sv", baseUrl);
    if (next) url.searchParams.set("id", next);
    await api(url.toString());
    location.reload();
  }

  async function clearOverrides() {
    await api("/api/dev/overrides/clear", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    location.reload();
  }

  async function doPreview(flag: string, id: string) {
    const u = new URL("/api/dev/rollout-preview", baseUrl);
    u.searchParams.set("flag", flag);
    u.searchParams.set("sid", id);
    const data = await api(u.toString());
    setPreview(data);
  }

  useEffect(() => {
    if (selectedFlag) doPreview(selectedFlag, sid).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFlag, sid]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <section>
        <h2>Stable ID</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input value={sid} onChange={(e) => setSid(e.target.value)} style={{ width: 360 }} />
          <button onClick={() => setSvId(sid)}>Set stableId</button>
          <button onClick={() => setSvId("random")}>Random</button>
          <button onClick={() => setSvId("clear")}>Clear</button>
          <span style={{ opacity: 0.7 }}>
            current: <code>{stableId}</code>
          </span>
        </div>
      </section>

      <section>
        <h2>Overrides</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={clearOverrides}>Reset ALL overrides</button>
          <span style={{ opacity: 0.7 }}>
            cookie: <code>sv_flags_override</code>
          </span>
        </div>
        <pre
          style={{
            background: "var(--color-bg-inverse)",
            color: "var(--color-fg-inverse)",
            padding: 8,
            whiteSpace: "pre-wrap",
          }}
        >
          {overridesJson ?? "{}"}
        </pre>
      </section>

      <section>
        <h2>Flags</h2>
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left", padding: 6 }}>name</th>
              <th style={{ textAlign: "left", padding: 6 }}>type</th>
              <th style={{ textAlign: "left", padding: 6 }}>effective</th>
              <th style={{ textAlign: "left", padding: 6 }}>override (links)</th>
              <th style={{ textAlign: "left", padding: 6 }}>Copy cURL</th>
            </tr>
          </thead>
          <tbody>
            {registry.map((m) => {
              const v = serverFlags[m.name];
              const variantOptions = m.type === "variant" ? (m.variants ?? []) : [];
              const curlOn = buildOverrideCurl(
                baseUrl,
                m.name,
                m.type === "string"
                  ? "on"
                  : m.type === "variant"
                    ? (variantOptions[0] ?? "control")
                    : true,
              );
              const curlOff = buildOverrideCurl(
                baseUrl,
                m.name,
                m.type === "string" ? "" : m.type === "variant" ? (variantOptions[1] ?? "") : false,
              );
              const curlReset = buildOverrideCurl(baseUrl, m.name, null);
              return (
                <tr key={m.name}>
                  <td style={{ padding: 6 }}>
                    <button
                      onClick={() => setSelectedFlag(m.name)}
                      title="Preview rollout on the right"
                    >
                      {m.name}
                    </button>
                    {m.deprecated && (
                      <span style={{ marginLeft: 6, color: "var(--color-status-warn)" }}>
                        &nbsp;deprecated
                      </span>
                    )}
                    {m.ignoreOverrides && (
                      <span style={{ marginLeft: 6, color: "var(--color-status-alert)" }}>
                        &nbsp;ignoreOverrides
                      </span>
                    )}
                  </td>
                  <td style={{ padding: 6 }}>{m.type}</td>
                  <td style={{ padding: 6 }}>
                    <code>{String(v)}</code>
                  </td>
                  <td style={{ padding: 6 }}>
                    {m.type === "variant" ? (
                      <>
                        {variantOptions.map((opt) => (
                          <a
                            key={opt}
                            style={{ marginRight: 8 }}
                            href={`${baseUrl}/api/ff-override?ff=${encodeURIComponent(`${m.name}:${JSON.stringify(opt)}`)}`}
                          >
                            {opt}
                          </a>
                        ))}
                        <a
                          href={`${baseUrl}/api/ff-override?ff=${encodeURIComponent(`${m.name}:null`)}`}
                        >
                          Reset
                        </a>
                      </>
                    ) : (
                      <>
                        <a
                          href={`${baseUrl}/api/ff-override?ff=${encodeURIComponent(`${m.name}:${JSON.stringify(m.type === "string" ? "on" : true)}`)}`}
                        >
                          ON
                        </a>
                        {" | "}
                        <a
                          href={`${baseUrl}/api/ff-override?ff=${encodeURIComponent(`${m.name}:${JSON.stringify(m.type === "string" ? "" : false)}`)}`}
                        >
                          OFF
                        </a>
                        {" | "}
                        <a
                          href={`${baseUrl}/api/ff-override?ff=${encodeURIComponent(`${m.name}:null`)}`}
                        >
                          Reset
                        </a>
                      </>
                    )}
                  </td>
                  <td style={{ padding: 6, fontFamily: "monospace" }}>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {m.type === "variant" ? (
                        <>
                          {variantOptions.map((opt) => (
                            <button
                              key={opt}
                              onClick={() =>
                                navigator.clipboard?.writeText(
                                  buildOverrideCurl(baseUrl, m.name, opt),
                                )
                              }
                            >
                              {opt}
                            </button>
                          ))}
                          <button onClick={() => navigator.clipboard?.writeText(curlReset)}>
                            Reset
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => navigator.clipboard?.writeText(curlOn)}>ON</button>
                          <button onClick={() => navigator.clipboard?.writeText(curlOff)}>
                            OFF
                          </button>
                          <button onClick={() => navigator.clipboard?.writeText(curlReset)}>
                            Reset
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section>
        <h2>Rollout Preview</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <label>
            Flag:&nbsp;
            <select value={selectedFlag} onChange={(e) => setSelectedFlag(e.target.value)}>
              {registry
                .filter((r) => r.type === "rollout")
                .map((r) => (
                  <option key={r.name} value={r.name}>
                    {r.name}
                  </option>
                ))}
            </select>
          </label>
          <label>
            StableId:&nbsp;
            <input value={sid} onChange={(e) => setSid(e.target.value)} style={{ width: 360 }} />
          </label>
          <button onClick={() => doPreview(selectedFlag, sid)}>Check</button>
        </div>
        {preview && (
          <div style={{ marginTop: 8 }}>
            <div>
              enabled: <code>{String(preview.enabled)}</code>
            </div>
            <div>
              percent: <code>{preview.percent}</code>
            </div>
            <div>
              salt: <code>{preview.salt}</code>
            </div>
            <div>
              inRollout: <code>{String(preview.inRollout)}</code>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
