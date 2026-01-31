# Implementierungsplan: Unified Document Composer (Option B - Inkrementell)

## Übersicht

Dieser Plan beschreibt die schrittweise Umsetzung des "Smart UX Konzepts" für den Document Generator.
Die Implementierung erfolgt in **3 Phasen** mit klaren Meilensteinen.

**Gesamtaufwand geschätzt:** 120-150 Stunden

---

## Phase 1: Canvas-View & Visuelles Klausel-System

**Ziel:** 3-Spalten-Layout einführen mit visueller Unterscheidung Global/Lokal

**Geschätzter Aufwand:** 50-60 Stunden

### 1.1 Datenmodell-Erweiterungen (Backend)

#### Neue Tabelle: `document_clause_instances`

```python
# backend/app/models/composer.py (NEU)

class ClauseOrigin(str, enum.Enum):
    GLOBAL = "global"      # Aus Bibliothek, schreibgeschützt
    LOCAL = "local"        # Im Dokument erstellt
    DEVIATION = "deviation" # War global, wurde aufgebrochen

class DocumentClauseInstance(Base):
    """
    Klausel-Instanz innerhalb eines Dokuments (Draft oder Generated).

    Smart UX Konzept:
    - GLOBAL (grün): Referenz zu Clause-Tabelle, read-only
    - LOCAL (blau): Eigener Content, frei editierbar
    - DEVIATION (blau): Kopie von Global, editierbar
    """
    __tablename__ = "document_clause_instances"

    id = Column(Integer, primary_key=True, index=True)

    # Zuordnung zu Draft ODER GeneratedDocument (genau eines)
    document_draft_id = Column(Integer, ForeignKey("document_drafts.id", ondelete="CASCADE"), nullable=True, index=True)
    generated_document_id = Column(Integer, ForeignKey("generated_documents.id", ondelete="CASCADE"), nullable=True, index=True)

    # Herkunft
    clause_origin = Column(String(20), nullable=False, default="local")  # global, local, deviation

    # Verknüpfung zu globaler Klausel (nur bei origin=global oder für deviation-tracking)
    source_clause_id = Column(Integer, ForeignKey("clauses.id", ondelete="SET NULL"), nullable=True, index=True)
    source_clause_version = Column(Integer, nullable=True)  # Welche Version wurde referenziert

    # Inhalt (für local/deviation)
    title = Column(String(255), nullable=False)
    content_html = Column(Text, nullable=True)  # NULL bei global (wird aus Clause geladen)

    # Reihenfolge
    display_order = Column(Integer, nullable=False, default=0)

    # Tracking für Deviations
    deviated_at = Column(DateTime(timezone=True), nullable=True)
    deviated_by_user_id = Column(Integer, nullable=True)
    deviated_reason = Column(Text, nullable=True)  # "Anpassung für Sonderfall XY"

    # Promotion-Tracking
    promoted_to_clause_id = Column(Integer, ForeignKey("clauses.id", ondelete="SET NULL"), nullable=True)
    promoted_at = Column(DateTime(timezone=True), nullable=True)

    # Metadaten
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # Relationships
    source_clause = relationship("Clause", foreign_keys=[source_clause_id])
    promoted_clause = relationship("Clause", foreign_keys=[promoted_to_clause_id])

    __table_args__ = (
        # Entweder draft_id ODER document_id, nicht beide
        CheckConstraint(
            "(document_draft_id IS NOT NULL AND generated_document_id IS NULL) OR "
            "(document_draft_id IS NULL AND generated_document_id IS NOT NULL)",
            name="check_single_parent"
        ),
    )
```

#### Migration erstellen

```bash
# Alembic Migration
alembic revision --autogenerate -m "add_document_clause_instances"
```

#### Dateien zu erstellen/ändern:

| Datei | Aktion | Beschreibung |
|-------|--------|--------------|
| `backend/app/models/composer.py` | NEU | DocumentClauseInstance Model |
| `backend/app/models/__init__.py` | ÄNDERN | Export hinzufügen |
| `backend/migrations/versions/xxx_add_clause_instances.py` | NEU | Migration |

---

### 1.2 Neue API-Endpoints (Backend)

#### Datei: `backend/app/api/v1/endpoints/composer.py` (NEU)

```python
"""
Unified Document Composer API

Smart UX Konzept Endpoints:
- Klausel-Instanzen verwalten (CRUD)
- Bibliothek durchsuchen
- Deviation-Flow
- Promotion-Flow
"""

router = APIRouter(prefix="/composer", tags=["composer"])

# ══════════════════════════════════════════════════════════════════════════════
# KLAUSEL-INSTANZ MANAGEMENT
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/drafts/{draft_id}/clauses")
async def get_draft_clauses(draft_id: int, ...):
    """
    Lädt alle Klausel-Instanzen eines Drafts.

    Response:
    [
        {
            "id": 1,
            "origin": "global",
            "source_clause_id": 42,
            "title": "§1 Vertragsparteien",
            "content_html": "...",  # Bei global: aus Clause-Tabelle geladen
            "display_order": 1,
            "is_editable": false,
            "visual_style": "green"  # green=global, blue=local/deviation
        },
        ...
    ]
    """
    pass

@router.post("/drafts/{draft_id}/clauses")
async def add_clause_to_draft(draft_id: int, clause_data: ClauseInstanceCreate, ...):
    """
    Fügt eine Klausel zum Draft hinzu.

    Zwei Modi:
    1. source_clause_id gegeben → Global-Klausel referenzieren
    2. title + content_html gegeben → Lokale Klausel erstellen
    """
    pass

@router.put("/drafts/{draft_id}/clauses/{instance_id}")
async def update_clause_instance(draft_id: int, instance_id: int, ...):
    """
    Aktualisiert eine Klausel-Instanz.

    WICHTIG: Nur für local/deviation erlaubt!
    Bei global → HTTP 400 "Globale Klausel kann nicht editiert werden"
    """
    pass

@router.delete("/drafts/{draft_id}/clauses/{instance_id}")
async def remove_clause_from_draft(draft_id: int, instance_id: int, ...):
    """Entfernt eine Klausel-Instanz vom Draft."""
    pass

@router.patch("/drafts/{draft_id}/clauses/reorder")
async def reorder_draft_clauses(draft_id: int, new_order: list[int], ...):
    """
    Ändert die Reihenfolge der Klauseln.

    Input: [instance_id_1, instance_id_2, ...]
    → Aktualisiert display_order entsprechend
    """
    pass

# ══════════════════════════════════════════════════════════════════════════════
# DEVIATION FLOW (Phase 2, aber API schon vorbereiten)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/drafts/{draft_id}/clauses/{instance_id}/deviate")
async def deviate_clause(draft_id: int, instance_id: int, ...):
    """
    "Schloss öffnen" - Wandelt Global → Deviation um.

    1. Prüft dass instance.origin == "global"
    2. Kopiert content_html von source_clause
    3. Setzt origin = "deviation"
    4. Setzt deviated_at, deviated_by_user_id

    Ab jetzt ist die Klausel editierbar.
    """
    pass

# ══════════════════════════════════════════════════════════════════════════════
# PROMOTION FLOW (Phase 3, aber API schon vorbereiten)
# ══════════════════════════════════════════════════════════════════════════════

@router.post("/drafts/{draft_id}/clauses/{instance_id}/promote")
async def promote_to_library(draft_id: int, instance_id: int, ...):
    """
    "In Bibliothek aufnehmen" - Erstellt neue globale Klausel.

    1. Prüft dass instance.origin == "local" oder "deviation"
    2. Erstellt neue Clause in clauses-Tabelle
    3. Setzt instance.promoted_to_clause_id
    4. Optional: Wandelt instance zu "global" um

    Erfordert Admin-Rechte oder Approval-Workflow.
    """
    pass

# ══════════════════════════════════════════════════════════════════════════════
# BIBLIOTHEK-SUCHE
# ══════════════════════════════════════════════════════════════════════════════

@router.get("/library")
async def search_library(
    country_code: str = "DE",
    category: str | None = None,
    search: str | None = None,
    limit: int = 50,
    ...
):
    """
    Durchsucht die Klausel-Bibliothek für Drag&Drop.

    Response:
    [
        {
            "id": 42,
            "title": "§3 Urlaub",
            "category": "Arbeitszeit",
            "preview": "Der Mitarbeiter hat Anspruch auf...",  # Erste 100 Zeichen
            "version": 3,
            "is_approved": true
        },
        ...
    ]
    """
    pass
```

#### Dateien zu erstellen/ändern:

| Datei | Aktion | Beschreibung |
|-------|--------|--------------|
| `backend/app/api/v1/endpoints/composer.py` | NEU | Alle Composer-Endpoints |
| `backend/app/api/v1/__init__.py` | ÄNDERN | Router registrieren |
| `backend/app/schemas/composer.py` | NEU | Pydantic Models |

---

### 1.3 Frontend: 3-Spalten-Layout

#### Neue Hauptkomponente: `UnifiedDocumentComposer.tsx`

```
frontend/src/pages/
├── DocumentGenerator.tsx      (BEHALTEN - Legacy)
└── UnifiedDocumentComposer.tsx (NEU - Smart UX)
```

#### Struktur der neuen Seite:

```typescript
// frontend/src/pages/UnifiedDocumentComposer.tsx

/**
 * Unified Document Composer - Smart UX Konzept
 *
 * 3-Spalten-Layout:
 * - Links (20%): Klausel-Bibliothek (Drag-Source)
 * - Mitte (55%): Document Canvas (Drop-Zone + Editor)
 * - Rechts (25%): Properties Panel (Kontext-sensitiv)
 */

export const UnifiedDocumentComposer = () => {
    // State
    const [draftId, setDraftId] = useState<number | null>(null);
    const [clauseInstances, setClauseInstances] = useState<ClauseInstance[]>([]);
    const [selectedClauseId, setSelectedClauseId] = useState<number | null>(null);
    const [librarySearch, setLibrarySearch] = useState("");

    return (
        <div className="h-[calc(100vh-140px)] flex">
            {/* LEFT: Bibliothek */}
            <ClauseLibrarySidebar
                onDragStart={handleDragStart}
                searchQuery={librarySearch}
                onSearchChange={setLibrarySearch}
            />

            {/* CENTER: Canvas */}
            <DocumentCanvas
                clauses={clauseInstances}
                onClausesChange={setClauseInstances}
                selectedClauseId={selectedClauseId}
                onSelectClause={setSelectedClauseId}
                onDropFromLibrary={handleDropFromLibrary}
            />

            {/* RIGHT: Properties */}
            <ClausePropertiesPanel
                clause={selectedClause}
                onUpdate={handleUpdateClause}
                onDeviate={handleDeviateClause}
                onPromote={handlePromoteClause}
            />
        </div>
    );
};
```

#### Neue Komponenten:

| Komponente | Datei | Beschreibung |
|------------|-------|--------------|
| `ClauseLibrarySidebar` | `components/composer/ClauseLibrarySidebar.tsx` | Linke Spalte mit Suche + Kategorien |
| `DocumentCanvas` | `components/composer/DocumentCanvas.tsx` | Mittlere Spalte, Haupteditor |
| `ClauseBlock` | `components/composer/ClauseBlock.tsx` | Einzelne Klausel im Canvas |
| `ClausePropertiesPanel` | `components/composer/ClausePropertiesPanel.tsx` | Rechte Spalte, Properties |
| `LibraryClauseCard` | `components/composer/LibraryClauseCard.tsx` | Draggable Klausel in Bibliothek |

---

### 1.4 Visuelles Klausel-System

#### Farbcodierung:

```css
/* frontend/src/styles/composer.css */

/* GLOBAL - Grün (aus Bibliothek, schreibgeschützt) */
.clause-block--global {
    border-left: 4px solid #22c55e;  /* green-500 */
    background: linear-gradient(to right, #f0fdf4, transparent);
}

.clause-block--global .clause-lock-icon {
    color: #22c55e;
}

/* LOCAL - Blau (im Dokument erstellt) */
.clause-block--local {
    border-left: 4px solid #3b82f6;  /* blue-500 */
    background: linear-gradient(to right, #eff6ff, transparent);
}

/* DEVIATION - Blau mit Indikator (war global, wurde geöffnet) */
.clause-block--deviation {
    border-left: 4px solid #3b82f6;
    background: linear-gradient(to right, #eff6ff, transparent);
}

.clause-block--deviation::before {
    content: "Abgewandelt";
    position: absolute;
    top: -8px;
    right: 8px;
    font-size: 10px;
    padding: 2px 6px;
    background: #dbeafe;
    color: #1d4ed8;
    border-radius: 4px;
}
```

#### ClauseBlock Komponente:

```typescript
// frontend/src/components/composer/ClauseBlock.tsx

interface ClauseBlockProps {
    clause: ClauseInstance;
    isSelected: boolean;
    onSelect: () => void;
    onReorder: (direction: "up" | "down") => void;
    disabled?: boolean;
}

export const ClauseBlock = ({ clause, isSelected, onSelect, ...props }: ClauseBlockProps) => {
    const isGlobal = clause.origin === "global";
    const isLocal = clause.origin === "local";
    const isDeviation = clause.origin === "deviation";

    return (
        <motion.div
            className={cn(
                "clause-block relative p-4 rounded-lg border cursor-pointer transition-all",
                isGlobal && "clause-block--global",
                isLocal && "clause-block--local",
                isDeviation && "clause-block--deviation",
                isSelected && "ring-2 ring-primary ring-offset-2"
            )}
            onClick={onSelect}
            layout
        >
            {/* Header */}
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    {/* Drag Handle */}
                    <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />

                    {/* Lock/Edit Icon */}
                    {isGlobal ? (
                        <Lock className="w-4 h-4 text-green-600" />
                    ) : (
                        <Edit3 className="w-4 h-4 text-blue-600" />
                    )}

                    {/* Title */}
                    <span className="font-medium">{clause.title}</span>
                </div>

                {/* Origin Badge */}
                <Badge variant={isGlobal ? "success" : "info"}>
                    {isGlobal ? "Standard" : isDeviation ? "Abgewandelt" : "Individuell"}
                </Badge>
            </div>

            {/* Content Preview */}
            <div
                className={cn(
                    "text-sm text-muted-foreground line-clamp-3",
                    isGlobal && "select-none"  // Kein Text-Select bei Global
                )}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(clause.content_html || "") }}
            />

            {/* Global: Hint */}
            {isGlobal && (
                <div className="mt-2 text-xs text-green-700 flex items-center gap-1">
                    <Info className="w-3 h-3" />
                    Klicken Sie auf das Schloss, um diese Klausel anzupassen
                </div>
            )}
        </motion.div>
    );
};
```

---

### 1.5 Drag & Drop Integration

#### Bibliothek → Canvas (mit dnd-kit):

```typescript
// frontend/src/pages/UnifiedDocumentComposer.tsx

import {
    DndContext,
    DragOverlay,
    useDraggable,
    useDroppable
} from "@dnd-kit/core";

export const UnifiedDocumentComposer = () => {
    const [activeLibraryClause, setActiveLibraryClause] = useState<LibraryClause | null>(null);

    const handleDragStart = (event: DragStartEvent) => {
        if (event.active.data.current?.type === "library-clause") {
            setActiveLibraryClause(event.active.data.current.clause);
        }
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveLibraryClause(null);

        if (!over) return;

        // Bibliothek → Canvas Drop
        if (active.data.current?.type === "library-clause" && over.id === "document-canvas") {
            const libraryClause = active.data.current.clause as LibraryClause;

            // Globale Klausel zum Draft hinzufügen
            addGlobalClauseToDraft(libraryClause.id);
        }

        // Reorder innerhalb Canvas
        if (active.data.current?.type === "canvas-clause" && over.data.current?.type === "canvas-clause") {
            reorderClauses(active.id as number, over.id as number);
        }
    };

    return (
        <DndContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            {/* ... Layout ... */}

            <DragOverlay>
                {activeLibraryClause && (
                    <div className="p-3 bg-white border-2 border-primary rounded-lg shadow-xl">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-green-600" />
                            <span className="font-medium">{activeLibraryClause.title}</span>
                        </div>
                    </div>
                )}
            </DragOverlay>
        </DndContext>
    );
};
```

---

### 1.6 Preview-Endpoint Anpassung

```python
# backend/app/api/v1/endpoints/preview.py

@router.post("/html/composer")
async def generate_composer_preview(
    draft_id: int,
    db: AsyncSession = Depends(get_db),
    ...
):
    """
    Generiert HTML-Preview für den Composer.

    Unterschied zu altem Endpoint:
    - Lädt ClauseInstances statt clause_ids
    - Unterscheidet global/local/deviation
    - Content kommt aus Instance ODER aus source_clause
    """
    # Lade Draft mit Instances
    instances = await load_clause_instances(db, draft_id)

    assembled_html = []
    for inst in instances:
        if inst.clause_origin == "global":
            # Content aus Clause-Tabelle
            clause = await db.get(Clause, inst.source_clause_id)
            content = clause.content_html
        else:
            # Content aus Instance
            content = inst.content_html

        assembled_html.append(f"""
            <section class="clause clause--{inst.clause_origin}" data-id="{inst.id}">
                <h3>{inst.title}</h3>
                {content}
            </section>
        """)

    return render_preview_html(assembled_html)
```

---

### 1.7 Routing & Navigation

```typescript
// frontend/src/App.tsx

<Routes>
    {/* Legacy Generator (bleibt erhalten) */}
    <Route path="/generator" element={<DocumentGenerator />} />

    {/* Neuer Composer (Smart UX) */}
    <Route path="/composer" element={<UnifiedDocumentComposer />} />
    <Route path="/composer/:draftId" element={<UnifiedDocumentComposer />} />

    {/* Redirect für Test-Phase */}
    {/* <Route path="/generator" element={<Navigate to="/composer" />} /> */}
</Routes>
```

---

### 1.8 Phase 1 Deliverables

| # | Deliverable | Akzeptanzkriterien |
|---|-------------|-------------------|
| 1 | Datenmodell | `DocumentClauseInstance` Tabelle existiert, Migration erfolgreich |
| 2 | API-Endpoints | `/api/v1/composer/*` Endpoints funktionieren |
| 3 | 3-Spalten-Layout | Bibliothek / Canvas / Properties sichtbar |
| 4 | Farbcodierung | Global=Grün, Local=Blau klar unterscheidbar |
| 5 | Drag & Drop | Klauseln können von Bibliothek in Canvas gezogen werden |
| 6 | Klausel-Reihenfolge | Im Canvas per Drag & Drop änderbar |
| 7 | Preview | Live-Preview zeigt gemischte Klauseln korrekt an |

---

## Phase 2: Deviation-Feature ("Schloss öffnen")

**Ziel:** Globale Klauseln können "aufgebrochen" und bearbeitet werden

**Geschätzter Aufwand:** 30-40 Stunden

### 2.1 Deviation-Flow UI

#### "Schloss öffnen" Interaktion:

```typescript
// frontend/src/components/composer/ClauseBlock.tsx

const handleUnlock = async () => {
    // Bestätigungsdialog
    const confirmed = await showConfirmDialog({
        title: "Standard abwandeln?",
        description: "Wenn Sie diese Klausel anpassen, wird sie von der Bibliothek entkoppelt. " +
                     "Änderungen am Original wirken sich nicht mehr auf dieses Dokument aus.",
        confirmText: "Ja, anpassen",
        cancelText: "Abbrechen",
        variant: "warning"
    });

    if (!confirmed) return;

    // API Call
    await api.post(`/api/v1/composer/drafts/${draftId}/clauses/${clause.id}/deviate`);

    // Optimistic Update
    setClause(prev => ({
        ...prev,
        origin: "deviation",
        content_html: prev.content_html,  // Jetzt editierbar
    }));

    toast.success("Klausel kann jetzt bearbeitet werden");
};
```

#### UI nach Deviation:

```typescript
// Nach dem "Aufbrechen" erscheint ein Inline-Editor

{clause.origin !== "global" && (
    <div className="mt-4">
        <RichTextEditor
            value={clause.content_html}
            onChange={(html) => handleContentChange(clause.id, html)}
            placeholder="Klauseltext eingeben..."
            toolbar={["bold", "italic", "underline", "link", "list"]}
        />
    </div>
)}
```

### 2.2 Deviation-Tracking

#### Backend-Erweiterung:

```python
# Beim Deviate speichern wir:

instance.clause_origin = "deviation"
instance.content_html = source_clause.content_html  # Kopie
instance.deviated_at = datetime.now(UTC)
instance.deviated_by_user_id = current_user.id
instance.deviated_reason = request.reason  # Optional

# Audit-Log eintrag
await create_audit_log(
    action="clause.deviate",
    entity_type="document_clause_instance",
    entity_id=instance.id,
    description=f"Klausel '{instance.title}' wurde vom Standard abgewandelt",
    old_value={"origin": "global"},
    new_value={"origin": "deviation", "reason": request.reason}
)
```

#### Deviation-Report:

```python
# Neuer Endpoint: Welche Dokumente haben Deviations?

@router.get("/reports/deviations")
async def get_deviation_report(
    document_type_id: int | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    ...
):
    """
    Report: Welche Klauseln wurden wann von wem abgewandelt?

    Nützlich für:
    - Compliance-Tracking
    - Identifizieren häufiger Anpassungen (→ neue Variante?)
    """
    pass
```

### 2.3 Rich-Text-Editor Integration

#### TipTap Setup:

```typescript
// frontend/src/components/composer/RichTextEditor.tsx

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

interface RichTextEditorProps {
    value: string;
    onChange: (html: string) => void;
    placeholder?: string;
    toolbar?: ("bold" | "italic" | "underline" | "link" | "list")[];
    disabled?: boolean;
}

export const RichTextEditor = ({ value, onChange, placeholder, toolbar, disabled }: RichTextEditorProps) => {
    const editor = useEditor({
        extensions: [
            StarterKit,
            Link.configure({ openOnClick: false }),
            Placeholder.configure({ placeholder }),
        ],
        content: value,
        editable: !disabled,
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    return (
        <div className="rich-text-editor border rounded-lg">
            {/* Toolbar */}
            <div className="border-b p-2 flex gap-1">
                {toolbar?.includes("bold") && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => editor?.chain().focus().toggleBold().run()}
                        className={editor?.isActive("bold") ? "bg-muted" : ""}
                    >
                        <Bold className="w-4 h-4" />
                    </Button>
                )}
                {/* ... weitere Toolbar-Buttons ... */}
            </div>

            {/* Editor */}
            <EditorContent editor={editor} className="p-4 min-h-[100px]" />
        </div>
    );
};
```

### 2.4 Phase 2 Deliverables

| # | Deliverable | Akzeptanzkriterien |
|---|-------------|-------------------|
| 1 | "Schloss öffnen" | Klick auf Lock-Icon zeigt Bestätigungsdialog |
| 2 | Deviation-Umwandlung | Nach Bestätigung: origin ändert sich, Content wird kopiert |
| 3 | Inline-Editor | Rich-Text-Editor erscheint für Deviation-Klauseln |
| 4 | Content-Speicherung | Änderungen werden automatisch gespeichert (Auto-Save) |
| 5 | Deviation-Tracking | Audit-Log erfasst wer/wann/warum |
| 6 | Visueller Indikator | "Abgewandelt"-Badge erscheint bei Deviations |

---

## Phase 3: Promotion + Lokale Klauseln erstellen

**Ziel:** Lokale Klauseln erstellen und "In Bibliothek aufnehmen"

**Geschätzter Aufwand:** 40-50 Stunden

### 3.1 Lokale Klausel erstellen

#### "Neuer Abschnitt" Button:

```typescript
// frontend/src/components/composer/DocumentCanvas.tsx

const handleAddLocalClause = async (position?: number) => {
    // Neue lokale Klausel erstellen
    const newClause = await api.post(`/api/v1/composer/drafts/${draftId}/clauses`, {
        title: "Neuer Abschnitt",
        content_html: "",
        display_order: position ?? clauseInstances.length,
    });

    // Sofort auswählen und Editor fokussieren
    setSelectedClauseId(newClause.id);
    setTimeout(() => {
        document.querySelector(`[data-clause-id="${newClause.id}"] .tiptap`)?.focus();
    }, 100);
};

return (
    <div className="document-canvas">
        {clauseInstances.map((clause, index) => (
            <React.Fragment key={clause.id}>
                <ClauseBlock clause={clause} ... />

                {/* "Hier klicken für neuen Text" Insertion Point */}
                <div
                    className="h-8 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
                    onClick={() => handleAddLocalClause(index + 1)}
                >
                    <div className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer hover:text-primary">
                        <Plus className="w-4 h-4" />
                        <span>Hier klicken für neuen Text</span>
                    </div>
                </div>
            </React.Fragment>
        ))}

        {/* Finaler "+" Button */}
        <Button variant="outline" onClick={() => handleAddLocalClause()}>
            <Plus className="w-4 h-4 mr-2" />
            Neuen Abschnitt hinzufügen
        </Button>
    </div>
);
```

### 3.2 Promotion-Flow

#### "In Bibliothek aufnehmen" Dialog:

```typescript
// frontend/src/components/composer/PromotionDialog.tsx

interface PromotionDialogProps {
    clause: ClauseInstance;
    onPromote: (data: PromotionData) => Promise<void>;
    onClose: () => void;
}

export const PromotionDialog = ({ clause, onPromote, onClose }: PromotionDialogProps) => {
    const [title, setTitle] = useState(clause.title);
    const [category, setCategory] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            await onPromote({
                title,
                category,
                content_html: clause.content_html,
                requires_approval: true,  // Immer Approval-Flow
            });

            toast.success(
                "Klausel eingereicht",
                "Die Klausel wurde zur Prüfung eingereicht und steht nach Freigabe in der Bibliothek bereit."
            );
            onClose();
        } catch (error) {
            toast.error("Fehler", "Klausel konnte nicht eingereicht werden");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open onOpenChange={onClose}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Star className="w-5 h-5 text-yellow-500" />
                        In Bibliothek aufnehmen
                    </DialogTitle>
                    <DialogDescription>
                        Diese Klausel wird als Standard-Baustein für alle zukünftigen Dokumente verfügbar.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div>
                        <Label>Titel der Klausel</Label>
                        <Input
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="z.B. §12 Homeoffice-Regelung"
                        />
                    </div>

                    <div>
                        <Label>Kategorie</Label>
                        <Select value={category} onValueChange={setCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Kategorie wählen..." />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="arbeitszeit">Arbeitszeit</SelectItem>
                                <SelectItem value="verguetung">Vergütung</SelectItem>
                                <SelectItem value="urlaub">Urlaub</SelectItem>
                                <SelectItem value="kuendigung">Kündigung</SelectItem>
                                <SelectItem value="sonstiges">Sonstiges</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <div className="flex items-start gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5" />
                            <div className="text-sm text-amber-800">
                                <strong>Hinweis:</strong> Die Klausel wird zur Prüfung eingereicht.
                                Nach Freigabe durch einen Administrator steht sie in der Bibliothek bereit.
                            </div>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Abbrechen</Button>
                    <Button onClick={handleSubmit} disabled={isSubmitting || !title || !category}>
                        {isSubmitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Star className="w-4 h-4 mr-2" />}
                        Zur Prüfung einreichen
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
```

### 3.3 Promotion Backend

```python
# backend/app/api/v1/endpoints/composer.py

@router.post("/drafts/{draft_id}/clauses/{instance_id}/promote")
async def promote_to_library(
    draft_id: int,
    instance_id: int,
    promotion: PromotionRequest,
    db: AsyncSession = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """
    Erstellt eine neue globale Klausel aus einer lokalen/deviation Instanz.
    """
    instance = await get_clause_instance(db, draft_id, instance_id, current_user.id)

    if instance.clause_origin == "global":
        raise HTTPException(400, "Globale Klauseln können nicht erneut promotet werden")

    # Neue Klausel erstellen (im Draft-Status)
    new_clause = Clause(
        title=promotion.title,
        content_html=instance.content_html,
        country_code=promotion.country_code or "DE",
        category=promotion.category,
        version=1,
        is_active=False,  # Noch nicht aktiv
        approval_status="pending",  # Zur Prüfung
        approval_requested_at=datetime.now(UTC),
        approval_requested_by=current_user.email,
    )
    db.add(new_clause)
    await db.flush()

    # Instance aktualisieren
    instance.promoted_to_clause_id = new_clause.id
    instance.promoted_at = datetime.now(UTC)

    # Optional: Instance zu "global" umwandeln
    if promotion.convert_to_global:
        instance.clause_origin = "global"
        instance.source_clause_id = new_clause.id
        instance.content_html = None  # Content kommt jetzt aus Clause

    await db.commit()

    # Benachrichtigung an Admins
    await notify_admins_of_pending_clause(db, new_clause.id, current_user)

    return {
        "status": "submitted",
        "new_clause_id": new_clause.id,
        "approval_required": True,
        "message": "Klausel wurde zur Prüfung eingereicht"
    }
```

### 3.4 Admin: Approval-Queue

```typescript
// frontend/src/pages/admin/PendingClausesPage.tsx

/**
 * Admin-Seite: Eingereichte Klauseln prüfen und freigeben
 */
export const PendingClausesPage = () => {
    const [pendingClauses, setPendingClauses] = useState<PendingClause[]>([]);

    const handleApprove = async (clauseId: number) => {
        await api.post(`/api/v1/clause-approval/${clauseId}/approve`);
        toast.success("Klausel freigegeben");
        refetch();
    };

    const handleReject = async (clauseId: number, reason: string) => {
        await api.post(`/api/v1/clause-approval/${clauseId}/reject`, { reason });
        toast.info("Klausel abgelehnt");
        refetch();
    };

    return (
        <div className="space-y-6">
            <h1>Eingereichte Klauseln</h1>

            {pendingClauses.map(clause => (
                <Card key={clause.id}>
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle>{clause.title}</CardTitle>
                            <Badge>Zur Prüfung</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            Eingereicht von {clause.requested_by} am {formatDate(clause.requested_at)}
                        </p>
                    </CardHeader>
                    <CardContent>
                        <div
                            className="prose max-w-none"
                            dangerouslySetInnerHTML={{ __html: sanitizeHtml(clause.content_html) }}
                        />
                    </CardContent>
                    <CardFooter className="flex gap-2">
                        <Button variant="outline" onClick={() => openRejectDialog(clause.id)}>
                            <XCircle className="w-4 h-4 mr-2" />
                            Ablehnen
                        </Button>
                        <Button onClick={() => handleApprove(clause.id)}>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Freigeben
                        </Button>
                    </CardFooter>
                </Card>
            ))}
        </div>
    );
};
```

### 3.5 Phase 3 Deliverables

| # | Deliverable | Akzeptanzkriterien |
|---|-------------|-------------------|
| 1 | Lokale Klausel erstellen | "+ Neuer Abschnitt" funktioniert |
| 2 | Inline-Editing | Rich-Text-Editor für lokale Klauseln |
| 3 | Promotion-Dialog | "In Bibliothek aufnehmen" öffnet Dialog |
| 4 | Approval-Workflow | Neue Klausel hat Status "pending" |
| 5 | Admin-Queue | Admins sehen und können Klauseln freigeben |
| 6 | Benachrichtigungen | Admins werden über neue Einreichungen informiert |

---

## Integration mit bestehendem System

### Formularfelder-Integration

Das Smart UX Konzept ersetzt **nicht** die Formularfelder (Mitarbeiterdaten, Gehalt, etc.).
Diese bleiben als **Top-Bereich** oder im **Properties-Panel**:

```typescript
// Option A: Formular als oberer Bereich im Canvas

<div className="document-canvas">
    {/* Fester Formular-Bereich */}
    <Card className="mb-6">
        <CardHeader>
            <CardTitle>Dokumentdaten</CardTitle>
        </CardHeader>
        <CardContent>
            <FormFields
                formData={formData}
                onChange={setFormData}
            />
        </CardContent>
    </Card>

    {/* Klauseln */}
    {clauseInstances.map(...)}
</div>
```

```typescript
// Option B: Formular im Properties-Panel (wenn keine Klausel ausgewählt)

<ClausePropertiesPanel>
    {selectedClause ? (
        <ClauseProperties clause={selectedClause} />
    ) : (
        <DocumentFormFields formData={formData} onChange={setFormData} />
    )}
</ClausePropertiesPanel>
```

### Varianten-System

Das bestehende Varianten-System (ClauseVariantGroup) bleibt erhalten:

```typescript
// Bei Global-Klauseln mit Varianten: Varianten-Auswahl im Properties-Panel

{selectedClause?.origin === "global" && selectedClause?.has_variants && (
    <div className="mt-4">
        <Label>Variante wählen</Label>
        <VariantSelector
            groupId={selectedClause.variant_group_id}
            selectedVariantId={selectedClause.selected_variant_id}
            onSelect={handleVariantSelect}
        />
    </div>
)}
```

### Conditional Clauses

Bedingte Klauseln werden weiterhin automatisch ein-/ausgeblendet:

```typescript
// Im Canvas: Bedingte Klauseln visuell kennzeichnen

{clause.condition && (
    <div className="absolute -top-3 left-4">
        <Badge variant="outline" className="text-xs bg-white">
            <Filter className="w-3 h-3 mr-1" />
            Bedingt: {clause.condition_label}
        </Badge>
    </div>
)}
```

---

## Migrations-Strategie

### Parallel-Betrieb

```
Phase 1-3 Entwicklung:
├── /generator → Alter Generator (produktiv)
└── /composer  → Neuer Composer (Beta)

Nach Phase 3:
├── /generator → Redirect zu /composer (mit Legacy-Flag)
└── /composer  → Neuer Composer (produktiv)
```

### Daten-Migration

```python
# Script: Bestehende Drafts in neues Format migrieren

async def migrate_draft_to_composer(draft_id: int):
    """
    Migriert einen bestehenden Draft zum neuen Composer-Format.

    Alte Struktur:
    - draft.form_data = JSON mit allen Daten
    - draft.custom_clauses = JSON mit Individualtexten

    Neue Struktur:
    - draft.form_data = JSON mit Formulardaten
    - DocumentClauseInstance[] = Klausel-Instanzen
    """
    draft = await db.get(DocumentDraft, draft_id)

    # Lade DocumentType-Klauseln als Globale
    doc_type_clauses = await load_document_type_clauses(draft.document_type_id)

    for i, dtc in enumerate(doc_type_clauses):
        instance = DocumentClauseInstance(
            document_draft_id=draft.id,
            clause_origin="global",
            source_clause_id=dtc.clause_id,
            title=dtc.clause.title,
            display_order=i,
        )
        db.add(instance)

    # Custom Clauses als Lokale hinzufügen
    if draft.custom_clauses:
        custom = json.loads(draft.custom_clauses)
        if custom.get("content"):
            instance = DocumentClauseInstance(
                document_draft_id=draft.id,
                clause_origin="local",
                title=custom.get("title", "Individualvereinbarung"),
                content_html=custom.get("content"),
                display_order=len(doc_type_clauses),
            )
            db.add(instance)

    await db.commit()
```

---

## Zusammenfassung

### Zeitplan

| Phase | Dauer | Abhängigkeiten |
|-------|-------|----------------|
| Phase 1 | 3-4 Wochen | - |
| Phase 2 | 2-3 Wochen | Phase 1 abgeschlossen |
| Phase 3 | 2-3 Wochen | Phase 2 abgeschlossen |
| **Gesamt** | **7-10 Wochen** | |

### Risiken

| Risiko | Mitigation |
|--------|------------|
| WYSIWYG-Editor Bugs | TipTap ist ausgereift, extensiv testen |
| Performance bei vielen Klauseln | Virtualization (react-window) vorbereiten |
| Benutzer-Akzeptanz | Beta-Test mit Pilotgruppe |
| Daten-Migration | Parallel-Betrieb, schrittweise Migration |

### Nächste Schritte

1. **Sofort:** Datenmodell-Review mit Team
2. **Woche 1:** Migration erstellen, API-Grundstruktur
3. **Woche 2-3:** Frontend-Layout + Drag&Drop
4. **Woche 4:** Integration + erste Tests

---

*Erstellt: 2026-01-27*
*Version: 1.0*
