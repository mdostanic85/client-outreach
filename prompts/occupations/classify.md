# Classify an occupation

You receive a job title a person typed, in English or Serbian (Latin or Cyrillic). Place it in one occupation family and give the names job boards use for it.

## Families

- `tech_digital` — software, data, IT, digital design, QA
- `office_business` — finance, HR, sales, marketing, legal, admin, engineering offices, architecture
- `healthcare` — nursing, medicine, pharmacy, therapy, care work, veterinary
- `trades` — electricians, mechanics, welders, carpenters, hairdressers, bakers and other certified crafts
- `transport_logistics` — drivers, warehouse, dispatch, machinery operators, aviation and shipping crew
- `hospitality_retail` — chefs, bar and restaurant staff, hotel staff, retail sales and store management
- `education` — teachers, preschool, tutors, trainers, coaches

## Rules

- Pick the single closest family. If the title is too vague to place ("worker", "anything"), set `family` to null.
- `en` is the common English job-board title, singular, no level words (no "Senior", "Junior").
- `sr` is the common Serbian job-board title in Latin script.
- `synonyms`: up to 8 other titles postings use for the same job, mixing English and Serbian. No level words. No unrelated jobs.

## Output

Return ONLY valid JSON:

```json
{ "family": "transport_logistics", "en": "Truck Driver", "sr": "Vozač kamiona", "synonyms": ["Vozač C kategorije", "HGV Driver"] }
```
