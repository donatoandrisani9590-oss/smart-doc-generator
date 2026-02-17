# AT-Angestellter Varianten-System Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Extend the existing Arbeitsvertrag with variant clauses for AT-Angestellte (above-tariff employees), controlled by a "Vertragsart" form field selector.

**Architecture:** Reuse the existing `ClauseVariantGroup`/`ClauseVariant` models to create Tarif/AT variants of 10 clauses. A new "vertragsart" form field auto-selects the correct variant via `auto_select_condition`. The preview and generation engines are extended to resolve variants. 4 new AT-only clauses are added as conditionals.

**Tech Stack:** FastAPI (Python 3.11), SQLAlchemy async, React 19 + TypeScript, Tailwind CSS, shadcn/ui

**Design Doc:** `docs/plans/2026-02-17-at-angestellter-varianten-design.md`

---

## Task 1: Add "vertragsart" Form Field to Frontend

**Files:**
- Modify: `frontend/src/components/generator/WizardContext.tsx:13-45`
- Modify: `frontend/src/components/generator/panels/FormFieldsSection.tsx:206-309,491-660`
- Modify: `frontend/src/hooks/wizard/useWizardFormData.ts` (initial defaults)

**Step 1: Add `vertragsart` to FormData interface**

In `WizardContext.tsx`, add to the `FormData` interface after `au_frist` (line 31):

```typescript
export interface FormData {
    // ... existing Vertragsdaten fields ...
    au_frist: string;
    vertragsart: string;  // "tarifgebunden" | "at_angestellter"

    // AT-Angestellter specific
    zielbonus: boolean;
    freistellung: boolean;
    spesen: boolean;
    renteneintritt: boolean;

    // ... existing Zusatzleistungen ...
}
```

**Step 2: Add defaults in initial state**

In `useWizardFormData.ts`, add to `initialFormData`:

```typescript
vertragsart: "tarifgebunden",
zielbonus: false,
freistellung: false,
spesen: false,
renteneintritt: false,
```

**Step 3: Add labels to FIELD_LABELS**

In `FormFieldsSection.tsx`, add to `FIELD_LABELS.de` (after `au_frist` entries):

```typescript
vertragsart: "Vertragsart",
vertragsart_tarif: "Tarifgebunden",
vertragsart_at: "AT-Angestellter",
vertragsart_hint: "AT = Außertariflich (oberhalb der höchsten Tarifgruppe)",
section_at: "AT-Optionen",
zielbonus: "Zielbonus / Variable Vergütung",
freistellung: "Freistellungsklausel (Garden Leave)",
spesen: "Spesen & Reisekosten",
renteneintritt: "Renteneintrittsklausel",
```

Add equivalent Italian labels to `FIELD_LABELS.it`.

**Step 4: Render Vertragsart select at top of Vertragsdaten section**

In `FormFieldsSection.tsx`, add as FIRST field in the "Vertragsdaten" section (after line 496):

```tsx
<div className="space-y-1">
    <Label htmlFor="vertragsart" className="text-xs flex items-center">
        {labels.vertragsart}
        <FieldHint fieldKey="vertragsart" lang={lang} />
    </Label>
    <Select
        value={formData.vertragsart}
        onValueChange={(v) => actions.updateFormField("vertragsart", v)}
    >
        <SelectTrigger className="h-8 text-sm">
            <SelectValue />
        </SelectTrigger>
        <SelectContent>
            <SelectItem value="tarifgebunden">{labels.vertragsart_tarif}</SelectItem>
            <SelectItem value="at_angestellter">{labels.vertragsart_at}</SelectItem>
        </SelectContent>
    </Select>
    <p className="text-[10px] text-muted-foreground">{labels.vertragsart_hint}</p>
</div>
```

**Step 5: Add conditional AT checkboxes section**

After the existing Zusatzleistungen section, add an AT-specific section that only shows when `vertragsart === "at_angestellter"`:

```tsx
{formData.vertragsart === "at_angestellter" && (
    <div className="space-y-3 pt-3 border-t">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {labels.section_at}
        </h4>
        <div className="space-y-2">
            <div className="flex items-center space-x-2">
                <Checkbox
                    id="zielbonus"
                    checked={formData.zielbonus}
                    onCheckedChange={(checked) => actions.updateFormField("zielbonus", checked === true)}
                />
                <Label htmlFor="zielbonus" className="text-sm cursor-pointer">{labels.zielbonus}</Label>
            </div>
            <div className="flex items-center space-x-2">
                <Checkbox
                    id="freistellung"
                    checked={formData.freistellung}
                    onCheckedChange={(checked) => actions.updateFormField("freistellung", checked === true)}
                />
                <Label htmlFor="freistellung" className="text-sm cursor-pointer">{labels.freistellung}</Label>
            </div>
            <div className="flex items-center space-x-2">
                <Checkbox
                    id="spesen"
                    checked={formData.spesen}
                    onCheckedChange={(checked) => actions.updateFormField("spesen", checked === true)}
                />
                <Label htmlFor="spesen" className="text-sm cursor-pointer">{labels.spesen}</Label>
            </div>
            <div className="flex items-center space-x-2">
                <Checkbox
                    id="renteneintritt"
                    checked={formData.renteneintritt}
                    onCheckedChange={(checked) => actions.updateFormField("renteneintritt", checked === true)}
                />
                <Label htmlFor="renteneintritt" className="text-sm cursor-pointer">{labels.renteneintritt}</Label>
            </div>
        </div>
    </div>
)}
```

**Step 6: Hide tariff-only fields when AT is selected**

When `vertragsart === "at_angestellter"`, hide:
- `entgeltgruppe` field (AT employees don't have tariff groups)
- `schichtzuschlaege` checkbox (replaced by Überstundenpauschale in AT variant)

Wrap these fields with `{formData.vertragsart !== "at_angestellter" && ( ... )}`.

**Step 7: Change Gehalt label dynamically**

When AT: Label changes from "Gehalt (EUR)" / "Brutto pro Monat" to "Jahresgehalt (EUR)" / "Brutto pro Jahr".

```tsx
const gehaltLabel = formData.vertragsart === "at_angestellter"
    ? (lang === "de" ? "Jahresgehalt (EUR)" : "Retribuzione Annua (EUR)")
    : labels.gehalt;
const gehaltPlaceholder = formData.vertragsart === "at_angestellter"
    ? (lang === "de" ? "Brutto pro Jahr" : "Lordo annuo")
    : labels.gehalt_placeholder;
```

**Step 8: Build and verify**

Run: `cd frontend && npm run build`
Expected: No TypeScript errors

**Step 9: Commit**

```bash
git add frontend/src/components/generator/WizardContext.tsx \
        frontend/src/components/generator/panels/FormFieldsSection.tsx \
        frontend/src/hooks/wizard/useWizardFormData.ts
git commit -m "feat: add Vertragsart selector + AT form fields to wizard"
```

---

## Task 2: Preview Engine — Variant Resolution

**Files:**
- Modify: `backend/app/services/preview.py:440-496`
- Modify: `backend/app/api/v1/endpoints/documents/preview.py:40-175`

**Step 1: Add variant resolution function to preview service**

In `backend/app/services/preview.py`, add before `assemble_html_preview()`:

```python
def resolve_variant_clause(
    clause: dict,
    variant_groups: list[dict],
    form_data: dict,
    selected_variants: dict[int, int] | None = None,
) -> dict | None:
    """
    Resolve a variant clause to its correct variant based on:
    1. Explicit selection (selected_variants)
    2. auto_select_condition matching form_data
    3. is_default=True fallback
    4. First active variant fallback

    Returns the resolved clause dict, or None if no variant found.
    """
    variant_group_name = clause.get("variant_group")
    if not variant_group_name:
        return clause

    # Find matching variant group
    group = None
    for vg in variant_groups:
        if vg["name"] == variant_group_name:
            group = vg
            break

    if not group or not group.get("variants"):
        return clause  # No group found, return original

    variants = group["variants"]

    # 1. Check explicit selection
    group_id = group["id"]
    if selected_variants and group_id in selected_variants:
        for v in variants:
            if v["id"] == selected_variants[group_id]:
                return {
                    **clause,
                    "title": v.get("clause_title", clause.get("title", "")),
                    "content": v.get("clause_content", clause.get("content", "")),
                    "variant_name": v.get("variant_name"),
                    "variant_code": v.get("variant_code"),
                }

    # 2. Check auto_select_condition
    for v in variants:
        condition = v.get("auto_select_condition")
        if condition and evaluate_condition(condition, form_data):
            return {
                **clause,
                "title": v.get("clause_title", clause.get("title", "")),
                "content": v.get("clause_content", clause.get("content", "")),
                "variant_name": v.get("variant_name"),
                "variant_code": v.get("variant_code"),
            }

    # 3. Fallback to default variant
    for v in variants:
        if v.get("is_default"):
            return {
                **clause,
                "title": v.get("clause_title", clause.get("title", "")),
                "content": v.get("clause_content", clause.get("content", "")),
                "variant_name": v.get("variant_name"),
                "variant_code": v.get("variant_code"),
            }

    # 4. Fallback to first variant
    if variants:
        v = variants[0]
        return {
            **clause,
            "title": v.get("clause_title", clause.get("title", "")),
            "content": v.get("clause_content", clause.get("content", "")),
            "variant_name": v.get("variant_name"),
            "variant_code": v.get("variant_code"),
        }

    return clause
```

**Step 2: Update `assemble_html_preview()` signature**

Add two new optional parameters:

```python
def assemble_html_preview(
    design_settings: dict,
    clauses: list[dict],
    form_data: dict,
    country_code: str = "DE",
    custom_clause: Optional[dict] = None,
    document_type_name: Optional[str] = None,
    document_type_category: Optional[str] = None,
    variant_groups: list[dict] | None = None,       # NEW
    selected_variants: dict[int, int] | None = None, # NEW
) -> str:
```

**Step 3: Add variant resolution in assemble_html_preview**

After the condition filtering loop (line ~463), add variant resolution:

```python
    # Resolve variant clauses (replace base clause with selected variant)
    if variant_groups:
        resolved_clauses = []
        for clause in active_clauses:
            if clause.get("clause_type") == "variant" and clause.get("variant_group"):
                resolved = resolve_variant_clause(clause, variant_groups, form_data, selected_variants)
                if resolved:
                    resolved_clauses.append(resolved)
            else:
                resolved_clauses.append(clause)
        active_clauses = resolved_clauses
```

**Step 4: Update preview endpoint to load variant groups**

In `backend/app/api/v1/endpoints/documents/preview.py`, modify `generate_preview()`.

Add import at top:
```python
from app.models.documents import ClauseVariantGroup, ClauseVariant, DocumentTypeVariantGroup
```

After loading clauses (line ~162), add variant group loading:

```python
    # 3b. Load variant groups for this document type
    variant_groups_data = None
    vg_result = await db.execute(
        select(DocumentTypeVariantGroup)
        .where(DocumentTypeVariantGroup.document_type_id == request.document_type_id)
        .order_by(DocumentTypeVariantGroup.display_order)
    )
    dtvgs = vg_result.scalars().all()

    if dtvgs:
        variant_groups_data = []
        for dtvg in dtvgs:
            group = await db.get(ClauseVariantGroup, dtvg.variant_group_id)
            if group and group.is_active:
                # Load variants with clause data
                variants_result = await db.execute(
                    select(ClauseVariant)
                    .where(ClauseVariant.group_id == group.id)
                    .where(ClauseVariant.is_active == True)
                    .order_by(ClauseVariant.sort_order)
                )
                variants = variants_result.scalars().all()

                variant_list = []
                for v in variants:
                    clause = await db.get(Clause, v.clause_id)
                    condition = None
                    if v.auto_select_condition:
                        try:
                            condition = json.loads(v.auto_select_condition) if isinstance(v.auto_select_condition, str) else v.auto_select_condition
                        except (json.JSONDecodeError, TypeError):
                            condition = None

                    variant_list.append({
                        "id": v.id,
                        "variant_name": v.variant_name,
                        "variant_code": v.variant_code,
                        "is_default": v.is_default,
                        "auto_select_condition": condition,
                        "clause_title": clause.title if clause else "",
                        "clause_content": clause.content_html if clause else "",
                    })

                variant_groups_data.append({
                    "id": group.id,
                    "name": group.name,
                    "variants": variant_list,
                })
```

Then pass to `assemble_html_preview()`:

```python
    html = assemble_html_preview(
        design_settings=design_dict,
        clauses=clauses,
        form_data=request.form_data,
        country_code=country_code,
        custom_clause=request.custom_clause,
        document_type_name=doc_type.name,
        document_type_category=doc_type.category,
        variant_groups=variant_groups_data,      # NEW
    )
```

**Step 5: Also include `clause_type` and `variant_group` in clause cache data**

In the clause loading loop (line ~152), add the missing fields:

```python
clauses.append({
    "id": clause.id,
    "title": clause.title,
    "content": clause.content_html,
    "is_mandatory": ref.is_mandatory,
    "has_paragraph_number": getattr(clause, 'has_paragraph_number', True),
    "condition": condition,
    "clause_type": getattr(ref, 'clause_type', 'standard'),       # NEW
    "variant_group": getattr(ref, 'variant_group', None),         # NEW
})
```

**Step 6: Run backend tests**

Run: `cd backend && python -m pytest tests/ -x -q`
Expected: Existing tests still pass (20 pre-existing failures are OK)

**Step 7: Commit**

```bash
git add backend/app/services/preview.py \
        backend/app/api/v1/endpoints/documents/preview.py
git commit -m "feat: add variant resolution to preview engine"
```

---

## Task 3: Generation Engine — Variant Resolution

**Files:**
- Modify: `backend/app/api/v1/endpoints/documents/generation.py:318-363,783-827`

**Step 1: Add `selected_variants` to GenerateDocumentRequest**

```python
class GenerateDocumentRequest(BaseModel):
    # ... existing fields ...

    # Variant selections (optional: variant groups → selected variant IDs)
    selected_variants: Optional[dict[str, int]] = Field(
        default=None,
        description="Mapping von Varianten-Gruppen-ID zu gewählter Varianten-ID"
    )
```

**Step 2: Load variant groups in generate_document_by_type**

After loading clause_refs (line ~789), add variant group loading (same pattern as preview endpoint):

```python
    # 3b. Load variant groups
    variant_groups_data = None
    vg_result = await db.execute(
        select(DocumentTypeVariantGroup)
        .where(DocumentTypeVariantGroup.document_type_id == document_type_id)
    )
    dtvgs = vg_result.scalars().all()

    if dtvgs:
        variant_groups_data = []
        for dtvg in dtvgs:
            group = await db.get(ClauseVariantGroup, dtvg.variant_group_id)
            if group and group.is_active:
                variants_result = await db.execute(
                    select(ClauseVariant)
                    .where(ClauseVariant.group_id == group.id, ClauseVariant.is_active == True)
                    .order_by(ClauseVariant.sort_order)
                )
                variants = variants_result.scalars().all()
                variant_list = []
                for v in variants:
                    vc = await db.get(Clause, v.clause_id)
                    condition = None
                    if v.auto_select_condition:
                        try:
                            condition = json.loads(v.auto_select_condition) if isinstance(v.auto_select_condition, str) else v.auto_select_condition
                        except (json.JSONDecodeError, TypeError):
                            condition = None
                    variant_list.append({
                        "id": v.id, "variant_name": v.variant_name, "variant_code": v.variant_code,
                        "is_default": v.is_default, "auto_select_condition": condition,
                        "clause_title": vc.title if vc else "", "clause_content": vc.content_html if vc else "",
                    })
                variant_groups_data.append({"id": group.id, "name": group.name, "variants": variant_list})
```

**Step 3: Apply variant resolution in clause loop**

In the clause assembly loop (line ~803), after condition evaluation, add:

```python
    from app.services.preview import resolve_variant_clause

    # Parse selected_variants from request
    selected_vars = None
    if request_data.selected_variants:
        selected_vars = {int(k): v for k, v in request_data.selected_variants.items()}

    for ref in clause_refs:
        clause = await db.get(Clause, ref.clause_id)
        if clause and clause.is_active:
            # ... existing condition parsing and evaluation ...

            if evaluate_condition(condition, form_data):
                clause_data = {
                    "id": clause.id,
                    "title": clause.title,
                    "content": clause.content_html,
                    "is_mandatory": ref.is_mandatory,
                    "has_paragraph_number": getattr(clause, 'has_paragraph_number', True),
                    "clause_type": getattr(ref, 'clause_type', 'standard'),
                    "variant_group": getattr(ref, 'variant_group', None),
                }

                # Resolve variant if applicable
                if variant_groups_data and ref.clause_type == "variant" and ref.variant_group:
                    resolved = resolve_variant_clause(clause_data, variant_groups_data, form_data, selected_vars)
                    if resolved:
                        clause_data = resolved

                active_clauses.append(clause_data)
```

**Step 4: Run backend tests**

Run: `cd backend && python -m pytest tests/ -x -q`

**Step 5: Commit**

```bash
git add backend/app/api/v1/endpoints/documents/generation.py
git commit -m "feat: add variant resolution to document generation"
```

---

## Task 4: Seed Data — AT Clause Content + Variant Groups

**Files:**
- Modify: `backend/app/api/v1/endpoints/config/setup.py`

This is the largest task — writing the actual AT clause content and creating a seed endpoint.

**Step 1: Add AT_ANGESTELLTER_CLAUSES array**

After `ARBEITSVERTRAG_CLAUSES` (line 501), add the 10 AT variant clauses. Each has content_html WITHOUT any Tarifvertrag/Haustarifvertrag/IG BCE references:

```python
AT_ANGESTELLTER_CLAUSES = [
    # Variant of § 2: Hinweis auf Tarifverträge → Kein Tarifvertrag
    {
        "title": "Geltungsbereich und Vertragsgrundlage",
        "content_html": '<p><strong>&sect; 2 Geltungsbereich und Vertragsgrundlage</strong></p>'
            '<p>Das Arbeitsverh&auml;ltnis ist au&szlig;ertariflich. Tarifvertr&auml;ge finden auf dieses Arbeitsverh&auml;ltnis keine Anwendung. '
            'Das Arbeitsverh&auml;ltnis wird ausschlie&szlig;lich durch diesen Vertrag sowie die jeweils g&uuml;ltigen betrieblichen Vereinbarungen und gesetzlichen Bestimmungen geregelt.</p>'
            '<p>Der Arbeitnehmer erh&auml;lt eine Gesamtverg&uuml;tung, die &uuml;ber der h&ouml;chsten tariflichen Entgeltgruppe liegt.</p>',
        "category": "Arbeitsrecht",
        "tags": ["at-angestellter", "außertariflich", "vertragsgrundlage"],
        "tone": "neutral",
        "variant_group": "tarifhinweis",
        "variant_name": "AT-Angestellter",
        "variant_code": "AT",
        "is_default_for_at": True,
    },
    # Variant of § 3: Probezeit → Ohne TV-Verweis
    {
        "title": "Probezeit",
        "content_html": '<p><strong>&sect; 3 Probezeit</strong></p>'
            '<p>Die ersten <strong>[probezeit]</strong> des Arbeitsverh&auml;ltnisses gelten als Probezeit. '
            'W&auml;hrend der Probezeit kann das Arbeitsverh&auml;ltnis von beiden Seiten mit einer Frist von zwei Wochen gek&uuml;ndigt werden (&sect;&nbsp;622 Abs.&nbsp;3 BGB).</p>',
        "category": "Arbeitsrecht",
        "tags": ["probezeit", "at-angestellter"],
        "tone": "neutral",
        "variant_group": "probezeit",
        "variant_name": "AT-Angestellter",
        "variant_code": "AT",
    },
    # Variant of § 5: Eingruppierung → Individuelle Vergütungsvereinbarung
    {
        "title": "Stellung und Vergütungsvereinbarung",
        "content_html": '<p><strong>&sect; 5 Stellung und Verg&uuml;tungsvereinbarung</strong></p>'
            '<p>Der Arbeitnehmer wird als au&szlig;ertariflicher Angestellter eingestellt. '
            'Die Verg&uuml;tung wird individuell vereinbart und liegt &uuml;ber der h&ouml;chsten tariflichen Entgeltgruppe.</p>'
            '<p>Eine &Auml;nderung der Verg&uuml;tung erfolgt durch individuelle Vereinbarung zwischen Arbeitgeber und Arbeitnehmer.</p>',
        "category": "Arbeitsrecht",
        "tags": ["eingruppierung", "at-angestellter", "individuell"],
        "tone": "neutral",
        "variant_group": "eingruppierung",
        "variant_name": "AT-Angestellter",
        "variant_code": "AT",
    },
    # Variant of § 7: Arbeitszeit → Vertrauensarbeitszeit
    {
        "title": "Arbeitszeit",
        "content_html": '<p><strong>&sect; 7 Arbeitszeit</strong></p>'
            '<p>Die regelm&auml;&szlig;ige w&ouml;chentliche Arbeitszeit betr&auml;gt <strong>[wochenstunden]</strong> Stunden. '
            'Die Verteilung der Arbeitszeit richtet sich nach den betrieblichen Erfordernissen und wird in Abstimmung mit dem Vorgesetzten festgelegt.</p>'
            '<p>Als au&szlig;ertariflicher Angestellter wird erwartet, dass der Arbeitnehmer seine Arbeitszeit eigenverantwortlich so gestaltet, '
            'dass die &uuml;bertragenen Aufgaben ordnungsgem&auml;&szlig; erf&uuml;llt werden. '
            'Gelegentliche Mehrarbeit ist mit der vereinbarten Verg&uuml;tung abgegolten, soweit sie 10&nbsp;% der vereinbarten w&ouml;chentlichen Arbeitszeit nicht &uuml;berschreitet (&Uuml;berstundenpauschale).</p>',
        "category": "Arbeitsrecht",
        "tags": ["arbeitszeit", "vertrauensarbeitszeit", "at-angestellter", "überstundenpauschale"],
        "tone": "neutral",
        "variant_group": "arbeitszeit",
        "variant_name": "AT-Angestellter",
        "variant_code": "AT",
    },
    # Variant of § 9: Vergütung → Jahresgehalt
    {
        "title": "Vergütung",
        "content_html": '<p><strong>&sect; 9 Verg&uuml;tung</strong></p>'
            '<p>Der Arbeitnehmer erh&auml;lt ein j&auml;hrliches Bruttofestgehalt in H&ouml;he von <strong>[gehalt]&nbsp;&euro;</strong> (in Worten: [gehalt_wort] Euro). '
            'Die Auszahlung erfolgt in zw&ouml;lf gleichen monatlichen Raten, jeweils bargeldlos zum Ende eines Kalendermonats auf ein vom Arbeitnehmer benanntes Konto.</p>'
            '<p>Mit der vereinbarten Verg&uuml;tung sind s&auml;mtliche Leistungen des Arbeitnehmers abgegolten, einschlie&szlig;lich gelegentlicher Mehrarbeit im &uuml;blichen Umfang.</p>'
            '<p>Die Verg&uuml;tung wird j&auml;hrlich im Rahmen eines Gespr&auml;chs zwischen Arbeitgeber und Arbeitnehmer &uuml;berpr&uuml;ft. '
            'Ein Rechtsanspruch auf Gehaltserh&ouml;hung besteht nicht.</p>',
        "category": "Arbeitsrecht",
        "tags": ["vergütung", "jahresgehalt", "at-angestellter"],
        "tone": "neutral",
        "variant_group": "verguetung",
        "variant_name": "AT-Angestellter",
        "variant_code": "AT",
    },
    # Variant of § 10: Zuschläge → Überstundenpauschale
    {
        "title": "Überstundenpauschale und Mehrarbeit",
        "content_html": '<p><strong>&sect; 10 &Uuml;berstundenpauschale und Mehrarbeit</strong></p>'
            '<p>Mit der vereinbarten Bruttojahresverg&uuml;tung ist die Leistung von Mehrarbeit im &uuml;blichen Umfang abgegolten. '
            'Als &uuml;blicher Umfang gilt eine Mehrarbeit von bis zu 10&nbsp;% der regelm&auml;&szlig;igen w&ouml;chentlichen Arbeitszeit pro Monat.</p>'
            '<p>Bei dar&uuml;ber hinausgehender Mehrarbeit erfolgt ein Ausgleich durch Freizeit nach Abstimmung mit dem Vorgesetzten.</p>'
            '<p>Gesonderte Zuschl&auml;ge f&uuml;r Nacht-, Sonn- und Feiertagsarbeit werden nicht gew&auml;hrt, soweit gesetzlich nicht zwingend vorgeschrieben.</p>',
        "category": "Arbeitsrecht",
        "tags": ["überstundenpauschale", "mehrarbeit", "at-angestellter"],
        "tone": "neutral",
        "variant_group": "zuschlaege",
        "variant_name": "AT-Angestellter",
        "variant_code": "AT",
    },
    # Variant of § 11: Urlaub → Individuell
    {
        "title": "Urlaub",
        "content_html": '<p><strong>&sect; 11 Urlaub</strong></p>'
            '<p>Der Arbeitnehmer hat Anspruch auf einen j&auml;hrlichen Erholungsurlaub von <strong>[urlaubstage]</strong> Arbeitstagen, bezogen auf eine 5-Tage-Woche.</p>'
            '<p>Der Urlaub ist grunds&auml;tzlich im laufenden Kalenderjahr zu nehmen. '
            'Eine &Uuml;bertragung auf das n&auml;chste Kalenderjahr ist nur zul&auml;ssig, wenn dringende betriebliche oder in der Person des Arbeitnehmers liegende Gr&uuml;nde dies rechtfertigen. '
            '&Uuml;bertragener Urlaub ist bis zum 31.&nbsp;M&auml;rz des Folgejahres zu nehmen.</p>'
            '<p>Die zeitliche Festlegung des Urlaubs erfolgt unter Ber&uuml;cksichtigung der betrieblichen Belange und der W&uuml;nsche des Arbeitnehmers.</p>',
        "category": "Arbeitsrecht",
        "tags": ["urlaub", "at-angestellter"],
        "tone": "arbeitnehmerfreundlich",
        "variant_group": "urlaub",
        "variant_name": "AT-Angestellter",
        "variant_code": "AT",
    },
    # Variant of § 12: Sonderurlaub → Ohne TV-Verweis
    {
        "title": "Sonderurlaub und bezahlte Freistellung",
        "content_html": '<p><strong>&sect; 12 Sonderurlaub und bezahlte Freistellung</strong></p>'
            '<p>Der Arbeitnehmer hat Anspruch auf bezahlte Freistellung in folgenden F&auml;llen:</p>'
            '<ul>'
            '<li>Eigene Eheschlie&szlig;ung: 2 Arbeitstage</li>'
            '<li>Niederkunft der Ehefrau/Lebenspartnerin: 1 Arbeitstag</li>'
            '<li>Tod des Ehegatten/Lebenspartners oder eines Kindes: 2 Arbeitstage</li>'
            '<li>Tod eines Elternteils oder Schwiegerelternteils: 1 Arbeitstag</li>'
            '<li>Umzug aus betrieblichen Gr&uuml;nden: 1 Arbeitstag</li>'
            '<li>Schwere Erkrankung eines im Haushalt lebenden Angeh&ouml;rigen: bis zu 1 Arbeitstag</li>'
            '</ul>'
            '<p>Dar&uuml;ber hinaus wird der Arbeitnehmer f&uuml;r die Aus&uuml;bung &ouml;ffentlicher Ehren&auml;mter und zur Wahrnehmung gesetzlich vorgeschriebener Pflichten freigestellt, soweit gesetzlich vorgeschrieben.</p>',
        "category": "Arbeitsrecht",
        "tags": ["sonderurlaub", "freistellung", "at-angestellter"],
        "tone": "arbeitnehmerfreundlich",
        "variant_group": "sonderurlaub",
        "variant_name": "AT-Angestellter",
        "variant_code": "AT",
    },
    # Variant of § 16: Kündigung → Individuelle Fristen
    {
        "title": "Kündigung",
        "content_html": '<p><strong>&sect; 16 K&uuml;ndigung</strong></p>'
            '<p>Nach Ablauf der Probezeit kann das Arbeitsverh&auml;ltnis von beiden Seiten mit einer Frist von <strong>[kuendigungsfrist]</strong> gek&uuml;ndigt werden.</p>'
            '<p>Bei einer Betriebszugeh&ouml;rigkeit von mehr als 10 Jahren erh&ouml;ht sich die K&uuml;ndigungsfrist des Arbeitgebers auf 6 Monate zum Monatsende.</p>'
            '<p>Die K&uuml;ndigung bedarf der Schriftform. Das Recht zur fristlosen K&uuml;ndigung aus wichtigem Grund (&sect;&nbsp;626 BGB) bleibt unber&uuml;hrt.</p>',
        "category": "Arbeitsrecht",
        "tags": ["kündigung", "kündigungsfrist", "at-angestellter"],
        "tone": "neutral",
        "variant_group": "kuendigung",
        "variant_name": "AT-Angestellter",
        "variant_code": "AT",
    },
    # Variant of § 22: Ausschlussfristen → Individuell
    {
        "title": "Ausschlussfristen",
        "content_html": '<p><strong>&sect; 22 Ausschlussfristen</strong></p>'
            '<p>Anspr&uuml;che aus dem Arbeitsverh&auml;ltnis verfallen, wenn sie nicht innerhalb von <strong>drei Monaten</strong> nach F&auml;lligkeit schriftlich gegen&uuml;ber der anderen Vertragspartei geltend gemacht werden.</p>'
            '<p>Lehnt die andere Vertragspartei den Anspruch ab oder erkl&auml;rt sie sich nicht innerhalb von einem Monat, so verf&auml;llt der Anspruch, '
            'wenn er nicht innerhalb von drei Monaten nach der Ablehnung oder dem Fristablauf gerichtlich geltend gemacht wird.</p>'
            '<p>Diese Ausschlussfristen gelten nicht f&uuml;r Anspr&uuml;che aus vors&auml;tzlicher Vertragsverletzung, '
            'f&uuml;r den gesetzlichen Mindestlohn sowie f&uuml;r Anspr&uuml;che, die kraft Gesetzes unabdingbar sind.</p>',
        "category": "Arbeitsrecht",
        "tags": ["ausschlussfrist", "verfall", "at-angestellter"],
        "tone": "neutral",
        "variant_group": "ausschlussfristen",
        "variant_name": "AT-Angestellter",
        "variant_code": "AT",
    },
]
```

**Step 2: Add AT_ONLY_CLAUSES array (4 conditional clauses)**

```python
AT_ONLY_CLAUSES = [
    # Zielbonus (nach § 9 Vergütung, display_order 9.5 → wird dynamisch einsortiert)
    {
        "title": "Zielbonus / Variable Vergütung",
        "content_html": '<p><strong>Zielbonus / Variable Verg&uuml;tung</strong></p>'
            '<p>Zus&auml;tzlich zum Festgehalt kann der Arbeitnehmer einen j&auml;hrlichen Zielbonus erhalten. '
            'Die H&ouml;he des Zielbonus wird j&auml;hrlich im Rahmen einer Zielvereinbarung zwischen Arbeitgeber und Arbeitnehmer festgelegt.</p>'
            '<p>Der Zielbonus ist an die Erreichung der vereinbarten Ziele gekn&uuml;pft und wird nach Ablauf des Gesch&auml;ftsjahres berechnet. '
            'Die Auszahlung erfolgt sp&auml;testens mit der M&auml;rz-Abrechnung des Folgejahres.</p>'
            '<p>Ein Anspruch auf den Zielbonus besteht nur, wenn das Arbeitsverh&auml;ltnis zum Zeitpunkt der Auszahlung ungek&uuml;ndigt besteht (Stichtagsregelung). '
            'Bei unterj&auml;hrigem Eintritt oder Ausscheiden wird der Zielbonus zeitanteilig berechnet.</p>',
        "category": "Vergütung",
        "tags": ["zielbonus", "variable vergütung", "at-angestellter"],
        "tone": "neutral",
        "is_mandatory": False,
        "display_order": 91,  # After Vergütung
        "clause_type": "conditional",
        "condition": '{"AND": [{"field": "vertragsart", "operator": "=", "value": "at_angestellter"}, {"field": "zielbonus", "operator": "=", "value": true}]}',
    },
    # Freistellung bei Kündigung (nach § 16 Kündigung)
    {
        "title": "Freistellung bei Kündigung",
        "content_html": '<p><strong>Freistellung bei K&uuml;ndigung</strong></p>'
            '<p>Der Arbeitgeber ist berechtigt, den Arbeitnehmer nach Ausspruch einer K&uuml;ndigung &mdash; gleich durch welche Partei &mdash; '
            'unter Fortzahlung der Bez&uuml;ge unwiderruflich von der Arbeitspflicht freizustellen.</p>'
            '<p>W&auml;hrend der Freistellung sind noch bestehende Urlaubs- und Freizeitausgleichsanspr&uuml;che anzurechnen. '
            'Der Arbeitnehmer ist verpflichtet, w&auml;hrend der Freistellung anderweitigen Erwerb anzurechnen lassen (&sect;&nbsp;615 Satz&nbsp;2 BGB).</p>'
            '<p>Die Verpflichtung zur Verschwiegenheit, das Wettbewerbsverbot und die R&uuml;ckgabepflichten gelten w&auml;hrend der Freistellung unver&auml;ndert fort.</p>',
        "category": "Kündigung",
        "tags": ["freistellung", "garden leave", "at-angestellter"],
        "tone": "neutral",
        "is_mandatory": False,
        "display_order": 161,  # After Kündigung
        "clause_type": "conditional",
        "condition": '{"AND": [{"field": "vertragsart", "operator": "=", "value": "at_angestellter"}, {"field": "freistellung", "operator": "=", "value": true}]}',
    },
    # Renteneintrittsklausel (vor § 22 Ausschlussfristen)
    {
        "title": "Renteneintrittsklausel",
        "content_html": '<p><strong>Renteneintrittsklausel</strong></p>'
            '<p>Das Arbeitsverh&auml;ltnis endet, ohne dass es einer K&uuml;ndigung bedarf, '
            'mit Ablauf des Monats, in dem der Arbeitnehmer die Regelaltersgrenze der gesetzlichen Rentenversicherung erreicht.</p>'
            '<p>Die Parteien k&ouml;nnen einvernehmlich eine Fortf&uuml;hrung des Arbeitsverh&auml;ltnisses &uuml;ber die Regelaltersgrenze hinaus vereinbaren.</p>',
        "category": "Arbeitsrecht",
        "tags": ["renteneintritt", "altersgrenze", "at-angestellter"],
        "tone": "neutral",
        "is_mandatory": False,
        "display_order": 211,  # Before Ausschlussfristen
        "clause_type": "conditional",
        "condition": '{"AND": [{"field": "vertragsart", "operator": "=", "value": "at_angestellter"}, {"field": "renteneintritt", "operator": "=", "value": true}]}',
    },
    # Spesen & Reisekosten
    {
        "title": "Spesen und Reisekosten",
        "content_html": '<p><strong>Spesen und Reisekosten</strong></p>'
            '<p>Dem Arbeitnehmer werden die notwendigen Reisekosten und Spesen f&uuml;r dienstlich veranlasste Reisen erstattet. '
            'Die Erstattung richtet sich nach der jeweils g&uuml;ltigen betrieblichen Reisekostenrichtlinie.</p>'
            '<p>Soweit keine betriebliche Regelung besteht, werden die steuerlich anerkannten Pauschalen (Verpflegungsmehraufwendungen gem&auml;&szlig; &sect;&nbsp;9 Abs.&nbsp;4a EStG) erstattet.</p>'
            '<p>Reisekosten sind innerhalb von vier Wochen nach Beendigung der Dienstreise unter Beif&uuml;gung der Belege abzurechnen.</p>',
        "category": "Vergütung",
        "tags": ["spesen", "reisekosten", "at-angestellter"],
        "tone": "neutral",
        "is_mandatory": False,
        "display_order": 171,  # After Firmenwagen
        "clause_type": "conditional",
        "condition": '{"AND": [{"field": "vertragsart", "operator": "=", "value": "at_angestellter"}, {"field": "spesen", "operator": "=", "value": true}]}',
    },
]
```

**Step 3: Add VARIANT_GROUPS definition**

```python
VARIANT_GROUPS = [
    {"name": "tarifhinweis", "display_name": "Tarifvertragshinweis / Vertragsgrundlage", "description": "Tarif: Verweis auf Haustarifvertrag IG BCE. AT: Keine Tarifbindung, rein einzelvertragliche Regelung.", "category": "Arbeitsrecht", "base_display_order": 2},
    {"name": "probezeit", "display_name": "Probezeit", "description": "Tarif: Mit Haustarifvertrag Ziff. 63 Verweis. AT: Ohne Tarifverweis, rein gesetzlich.", "category": "Arbeitsrecht", "base_display_order": 3},
    {"name": "eingruppierung", "display_name": "Eingruppierung / Vergütungsvereinbarung", "description": "Tarif: Tarifliche Entgeltgruppe. AT: Individuelle Vergütungsvereinbarung über Tarif.", "category": "Arbeitsrecht", "base_display_order": 5},
    {"name": "arbeitszeit", "display_name": "Arbeitszeit", "description": "Tarif: 37,5h mit tariflichen Zuschlägen. AT: Vertrauensarbeitszeit mit Überstundenpauschale.", "category": "Arbeitsrecht", "base_display_order": 7},
    {"name": "verguetung", "display_name": "Vergütung", "description": "Tarif: Monatl. Bruttogehalt + 13. Gehalt + Urlaubsgeld + VWL. AT: Jahresgehalt pauschal.", "category": "Arbeitsrecht", "base_display_order": 9},
    {"name": "zuschlaege", "display_name": "Zuschläge / Überstundenpauschale", "description": "Tarif: Zuschläge gem. TV Ziff. 15-22. AT: Überstundenpauschale, keine Einzelzuschläge.", "category": "Arbeitsrecht", "base_display_order": 10},
    {"name": "urlaub", "display_name": "Urlaub", "description": "Tarif: Urlaub gem. TV Ziff. 31-34 mit Wartezeit. AT: Individuell vereinbart.", "category": "Arbeitsrecht", "base_display_order": 11},
    {"name": "sonderurlaub", "display_name": "Sonderurlaub und Freistellung", "description": "Tarif: Gem. TV Ziff. 56-58. AT: Ohne Tarifverweis, identische Leistungen.", "category": "Arbeitsrecht", "base_display_order": 12},
    {"name": "kuendigung", "display_name": "Kündigung", "description": "Tarif: Gem. TV Ziff. 65-70 + gesetzlich. AT: Individuelle Kündigungsfristen.", "category": "Arbeitsrecht", "base_display_order": 16},
    {"name": "ausschlussfristen", "display_name": "Ausschlussfristen", "description": "Tarif: Tarifliche Ausschlussfristen Ziff. 71-75. AT: Individuelle Ausschlussfristen.", "category": "Arbeitsrecht", "base_display_order": 22},
]
```

**Step 4: Create seed endpoint `POST /seed-at-variants`**

Add a new endpoint in `setup.py` that:
1. Creates the 10 AT clause entries in `clauses` table
2. Creates the 4 AT-only conditional clauses
3. Creates 10 `ClauseVariantGroup` entries
4. Links existing Tarif clauses as Variant 1 (is_default=True, auto_select_condition for tarifgebunden)
5. Links new AT clauses as Variant 2 (auto_select_condition for at_angestellter)
6. Creates `DocumentTypeVariantGroup` links to Arbeitsvertrag
7. Updates existing `DocumentTypeClause` entries for the 10 base clauses to `clause_type="variant"` and set `variant_group`
8. Creates `DocumentTypeClause` entries for the 4 AT-only clauses

```python
@router.post("/seed-at-variants")
async def seed_at_variants(
    current_user: Annotated[User, Depends(deps.get_current_active_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """Seed AT-Angestellter variant clauses and groups."""
    # Implementation follows the data structures above
    # ... (full implementation in actual code)
```

**Step 5: Run backend tests**

Run: `cd backend && python -m pytest tests/ -x -q`

**Step 6: Commit**

```bash
git add backend/app/api/v1/endpoints/config/setup.py
git commit -m "feat: add AT-Angestellter seed data (10 variants + 4 conditionals)"
```

---

## Task 5: Frontend — Variant Auto-Selection on Vertragsart Change

**Files:**
- Modify: `frontend/src/hooks/wizard/useWizardClauses.ts`
- Modify: `frontend/src/hooks/wizard/useWizardPreview.ts`

**Step 1: Auto-select variants when vertragsart changes**

In `useWizardClauses.ts`, add an effect that listens for `formData.vertragsart` changes and auto-selects the matching variant in each group:

```typescript
// Auto-select variants based on vertragsart
useEffect(() => {
    if (!variantGroups.length) return;

    const newSelections: Record<number, SelectedVariant> = {};

    for (const group of variantGroups) {
        // Check each variant's auto_select_condition
        const matchingVariant = group.variants?.find(v => {
            if (!v.auto_select_condition) return false;
            const cond = v.auto_select_condition;
            return cond.field === "vertragsart"
                && cond.operator === "="
                && cond.value === formData.vertragsart;
        });

        if (matchingVariant) {
            newSelections[group.id] = {
                variantId: matchingVariant.id,
                clauseId: matchingVariant.clause_id,
            };
        }
    }

    // Only update if selections differ
    setSelectedVariants(prev => {
        const hasChanges = Object.keys(newSelections).some(
            k => !prev[Number(k)] || prev[Number(k)].variantId !== newSelections[Number(k)].variantId
        );
        return hasChanges ? { ...prev, ...newSelections } : prev;
    });
}, [formData.vertragsart, variantGroups]);
```

**Step 2: Ensure variant clause IDs are included in preview**

In `useWizardPreview.ts`, verify the `variantClauseIds` mapping correctly sends variant clause IDs (this should already work from existing code).

**Step 3: Build and verify**

Run: `cd frontend && npm run build`

**Step 4: Commit**

```bash
git add frontend/src/hooks/wizard/useWizardClauses.ts \
        frontend/src/hooks/wizard/useWizardPreview.ts
git commit -m "feat: auto-select clause variants on vertragsart change"
```

---

## Task 6: Deploy + Seed + E2E Test

**Step 1: Push to main (triggers Vercel deploy)**

```bash
git push origin main
```

**Step 2: Deploy backend to Railway**

```bash
cd backend && railway up --detach
```

**Step 3: Run seed-at-variants endpoint**

After deployment, call the seed endpoint from the admin panel or via curl:
```bash
curl -X POST https://web-production-96d24.up.railway.app/api/v1/setup/seed-at-variants \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json"
```

**Step 4: E2E Test — Create AT Arbeitsvertrag**

Using the browser:
1. Navigate to /generate
2. Select "Arbeitsvertrag"
3. Change "Vertragsart" to "AT-Angestellter"
4. Verify: Entgeltgruppe field disappears, AT-Optionen section appears
5. Fill form data: Mehmet Öztürk, Extrusion Manager, 70000€, etc.
6. Enable: Zielbonus, Freistellung, Spesen
7. Verify preview shows AT clauses (no Haustarifvertrag references)
8. Export DOCX and verify content

**Step 5: E2E Test — Switch back to Tarifgebunden**

1. Change "Vertragsart" back to "Tarifgebunden"
2. Verify: Tarif clauses restore (with Haustarifvertrag references)
3. AT-Optionen section disappears
4. Entgeltgruppe field reappears

**Step 6: Final commit if fixes needed**

```bash
git add -A && git commit -m "fix: E2E test corrections for AT-Angestellter"
```

---

## Summary

| Task | Description | Files | Est. LOC |
|------|-------------|-------|----------|
| 1 | Vertragsart form field + AT checkboxes | 3 frontend files | ~150 |
| 2 | Preview engine variant resolution | 2 backend files | ~130 |
| 3 | Generation engine variant resolution | 1 backend file | ~60 |
| 4 | Seed data: AT clauses + variant groups | 1 backend file | ~400 |
| 5 | Auto-select variants on vertragsart change | 2 frontend files | ~40 |
| 6 | Deploy + seed + E2E test | — | — |
| **Total** | | **9 files** | **~780 LOC** |
