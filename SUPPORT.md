# Diagram Support

| Syntax | Native editable support | Common limitations |
|---|---|---|
| Mermaid flowchart | High | Click directives and uncommon edge/shape syntax may use hybrid export |
| Mermaid sequence | High | Titles, uncommon branch syntax, and advanced decorations may be partial |
| Mermaid class | High or visual, selectable | Advanced styling remains visual |
| Mermaid state / ER / Gantt | Basic to partial | Layout and advanced directives may be simplified |
| PlantUML sequence | High | Advanced arrows, branches, and skin parameters may be partial |
| PlantUML class / component | Basic to high | Notes, skin parameters, and uncommon containers may be partial |
| PlantUML use case | High | Actors, use cases, system boundaries, include/extend, and generalization are native; notes, business variants, and arrow hints use hybrid export |
| Other PlantUML families | Visual | Requires the configured external renderer |

The current diagram’s diagnostics are authoritative. Hybrid exports contain a hidden locked “Original visual reference” layer.
