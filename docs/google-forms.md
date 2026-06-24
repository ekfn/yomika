Append these styles to google forms for cleaner OCR results

```
@media print {
    [aria-label="この質問の点数。"],
    [aria-label="必須の質問"],
    [aria-label="ヘルプとフィードバック"]
    {
        display: none;
    }

    div:has(> [role="heading"][aria-level="3"]) {
        background: #f6f6f6;
        border: 1px solid #aaa;
        padding: 8px;
        border-radius: 4px;
    }

    body > span:last-child,
    div:has(> a[href^="//www.google.com/forms/about/"])
    {
        display: none;
    }

    [aria-describedby]:not([id]):has(+ div[id] + div:not([jsname])) {
        display: none;
    }

    /* header */
    div:has(> div[dir="auto"]+ div),
    div:has(> div > div[dir="auto"]+ div) +div,
    div:has(> div > div[dir="auto"]+ div) +div +div
    {
        display: none;
    }

    /* footer */
    div:has(> a[data-user-display-name])
    {
        display: none;
    }
}
```
