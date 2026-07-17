"use client";

import { useFeedockContext } from "../../context";
import { formatDate } from "../../shared/lib/format";
import { primaryText, secondaryText } from "../../shared/lib/surface";
import type { PublicUpdate } from "../../types";
import { Avatar } from "../../shared/ui/avatar";
import { DetailBack } from "../../shared/ui/detail-back";
import { SafeHtml } from "../../shared/ui/safe-html";

type Props = {
  update: PublicUpdate;
  onBack: () => void;
  /** Hide the in-body back affordance when the host renders its own (widget). */
  hideBack?: boolean;
};

/**
 * A single published update, as an article: a category eyebrow leads, then the
 * title, a why-it-matters line, a byline (author · date), the cover image, and
 * the full body.
 */
export function ChangelogDetail({ update, onBack, hideBack }: Props) {
  const { theme } = useFeedockContext();
  return (
    <div>
      {hideBack ? null : <DetailBack onBack={onBack} />}

      {/* Eyebrow: the category leads the article, above the title. */}
      <div
        style={{
          marginTop: 12,
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: "uppercase",
          color: theme.brand,
        }}
      >
        {update.category}
      </div>

      <h3
        style={{
          margin: "8px 0 0",
          fontSize: 20,
          fontWeight: 500,
          lineHeight: 1.25,
          color: primaryText(theme),
        }}
      >
        {update.title}
      </h3>
      {update.whyItMatters ? (
        <p
          style={{
            margin: "6px 0 0",
            fontSize: 14,
            lineHeight: 1.5,
            color: secondaryText(theme),
          }}
        >
          {update.whyItMatters}
        </p>
      ) : null}

      {/* Byline: author · date. */}
      <div
        style={{
          marginTop: 12,
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexWrap: "wrap",
          fontSize: 12.5,
          color: secondaryText(theme),
        }}
      >
        {update.author ? (
          <span
            style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          >
            <Avatar
              name={update.author.name}
              imageUrl={update.author.avatarUrl}
              size={20}
            />
            <span style={{ color: primaryText(theme) }}>
              {update.author.name}
            </span>
          </span>
        ) : null}
        <span>
          {update.author ? "· " : ""}
          {formatDate(update.publishedAt)}
        </span>
      </div>

      {/* Cover (hero) — after the header, before the body. */}
      {update.coverImageUrl ? (
        <img
          src={update.coverImageUrl}
          alt=""
          style={{
            width: "100%",
            maxHeight: 240,
            objectFit: "cover",
            borderRadius: 10,
            display: "block",
            margin: "14px 0 0",
          }}
        />
      ) : null}

      <SafeHtml
        html={update.body}
        style={{
          marginTop: 14,
          fontSize: 14,
          lineHeight: 1.6,
          color: theme.text,
          wordBreak: "break-word",
        }}
      />
    </div>
  );
}
