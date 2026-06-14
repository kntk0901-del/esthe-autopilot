"use client";

import { useState } from "react";
import { LoaderCircle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Therapist } from "@/lib/types";

export function TherapistSettingsForm({
  therapist,
}: {
  therapist: Therapist;
}) {
  const [displayName, setDisplayName] = useState(therapist.display_name);
  const [aliases, setAliases] = useState(therapist.aliases.join("、"));
  const [profileUrl, setProfileUrl] = useState(therapist.profile_url ?? "");
  const [imageUrl, setImageUrl] = useState(therapist.profile_image_url ?? "");
  const [publicationConsent, setPublicationConsent] = useState(
    therapist.publication_consent,
  );
  const [active, setActive] = useState(therapist.active);
  const [priority, setPriority] = useState(therapist.priority_flag);
  const [newcomer, setNewcomer] = useState(therapist.newcomer_flag);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");

  async function save() {
    setPending(true);
    setMessage("");
    const response = await fetch(`/api/therapists/${therapist.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        display_name: displayName,
        aliases: aliases
          .split(/[,、]/)
          .map((item) => item.trim())
          .filter(Boolean),
        profile_url: profileUrl || null,
        profile_image_url: imageUrl || null,
        publication_consent: publicationConsent,
        active,
        priority_flag: priority,
        newcomer_flag: newcomer,
      }),
    });
    const result = (await response.json()) as { message?: string };
    setPending(false);
    setMessage(response.ok ? "保存しました" : result.message ?? "保存に失敗しました");
  }

  return (
    <div className="space-y-3">
      <label className="block text-xs font-semibold text-[#626862]">
        表示名
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} className="input mt-1.5" />
      </label>
      <label className="block text-xs font-semibold text-[#626862]">
        別名（読点区切り）
        <input value={aliases} onChange={(event) => setAliases(event.target.value)} className="input mt-1.5" />
      </label>
      <label className="block text-xs font-semibold text-[#626862]">
        プロフィールURL
        <input type="url" value={profileUrl} onChange={(event) => setProfileUrl(event.target.value)} className="input mt-1.5" />
      </label>
      <label className="block text-xs font-semibold text-[#626862]">
        画像URL
        <input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} className="input mt-1.5" />
      </label>
      <Toggle label="掲載同意を確認済み" checked={publicationConsent} onChange={setPublicationConsent} />
      <Toggle label="在籍中" checked={active} onChange={setActive} />
      <Toggle label="重点掲載" checked={priority} onChange={setPriority} />
      <Toggle label="新人" checked={newcomer} onChange={setNewcomer} />
      <div className="flex items-center justify-between pt-2">
        <span className="text-xs text-[#777d78]">{message}</span>
        <Button size="sm" onClick={save} disabled={pending}>
          {pending ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          マスタを保存
        </Button>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between rounded-lg border bg-[#faf8f4] px-3 py-2 text-xs font-bold">
      {label}
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-[#2f7d6d]"
      />
    </label>
  );
}
