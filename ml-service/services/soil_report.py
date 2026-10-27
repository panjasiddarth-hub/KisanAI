"""Local extraction of selectable text from soil-test PDFs.

This parser intentionally does not run OCR or convert soil units. Parsed values
are suggestions for farmer review, not validated laboratory data.
"""

from datetime import date
from io import BytesIO
import re

from pypdf import PdfReader


FIELD_PATTERNS = {
    "soilPH": (r"soil\s*pH", r"pH(?:\s+value)?"),
    "soilEC": (r"electrical\s+conductivity", r"soil\s*EC", r"\bEC\b"),
    "soilOC": (r"organic\s+carbon", r"soil\s*OC", r"\bOC\b"),
    "soilN": (r"available\s+nitrogen", r"nitrogen(?:\s*\(N\))?", r"\bN\b"),
    "soilP": (r"available\s+phosphorus", r"phosphorus(?:\s*\([^)]*\))?", r"P\s*2\s*O\s*5", r"\bP\b"),
    "soilK": (r"available\s+potassium", r"potassium(?:\s*\([^)]*\))?", r"K\s*2\s*O", r"\bK\b"),
    "soilS": (r"available\s+sulph?ur", r"sulph?ur(?:\s*\(S\))?", r"\bS\b"),
    "soilZn": (r"zinc(?:\s*\(Zn\))?", r"\bZn\b"),
    "soilB": (r"boron(?:\s*\(B\))?", r"\bB\b"),
    "soilFe": (r"iron(?:\s*\(Fe\))?", r"\bFe\b"),
    "soilCu": (r"copper(?:\s*\(Cu\))?", r"\bCu\b"),
    "soilMn": (r"manganese(?:\s*\(Mn\))?", r"\bMn\b"),
}
COMPILED_PATTERNS = {
    field: tuple(re.compile(pattern, re.IGNORECASE) for pattern in patterns)
    for field, patterns in FIELD_PATTERNS.items()
}
NUMBER_PATTERN = re.compile(r"(?<![A-Za-z])[-+]?\d[\d,]*(?:\.\d+)?")
UNIT_PATTERN = re.compile(r"dS\s*/\s*m|kg\s*/\s*ha|mg\s*/\s*kg|ppm|%", re.IGNORECASE)
MONTHS = {month.lower(): number for number, month in enumerate((
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
), start=1)}


def _is_other_parameter_label(line: str, current_field: str) -> bool:
    return any(
        field != current_field and any(pattern.search(line) for pattern in patterns)
        for field, patterns in COMPILED_PATTERNS.items()
    )


def _extract_field(lines: list[str], field: str) -> dict:
    for index, line in enumerate(lines):
        for pattern in COMPILED_PATTERNS[field]:
            match = pattern.search(line)
            if not match:
                continue

            pieces = [line[match.end():]]
            for following in lines[index + 1:index + 5]:
                if _is_other_parameter_label(following, field):
                    break
                pieces.append(following)
            context = " ".join(pieces)
            # Chemical formula digits describe the analyte basis, not the reading.
            search_context = re.sub(r"P\s*2\s*O\s*5|K\s*2\s*O", "", context, flags=re.IGNORECASE)
            values = NUMBER_PATTERN.findall(search_context)
            if not values:
                continue
            try:
                value = float(values[0].replace(",", ""))
            except ValueError:
                continue

            unit_match = UNIT_PATTERN.search(context)
            unit = re.sub(r"\s+", "", unit_match.group(0)) if unit_match else None
            if unit and unit.lower() == "ds/m":
                unit = "dS/m"
            elif unit and unit.lower() == "kg/ha":
                unit = "kg/ha"
            elif unit and unit.lower() == "mg/kg":
                unit = "mg/kg"
            elif unit and unit.lower() == "ppm":
                unit = "ppm"
            elif field == "soilPH" and not unit:
                unit = "pH"

            analyte_basis = None
            if field == "soilP" and re.search(r"P\s*2\s*O\s*5", line, re.IGNORECASE):
                analyte_basis = "P2O5"
            elif field == "soilK" and re.search(r"K\s*2\s*O", line, re.IGNORECASE):
                analyte_basis = "K2O"
            if analyte_basis:
                unit = f"{unit or 'unit not stated'} {analyte_basis}"

            return {"value": value, "unit": unit, "confidence": "high" if unit else "medium"}

    return {"value": None, "unit": None, "confidence": "low"}


def _extract_date(text: str) -> str | None:
    iso_match = re.search(r"\b(20\d{2})-(\d{1,2})-(\d{1,2})\b", text)
    if iso_match:
        try:
            return date(*(int(part) for part in iso_match.groups())).isoformat()
        except ValueError:
            return None

    named_match = re.search(r"\b(\d{1,2})\s+([A-Za-z]+)\s+(20\d{2})\b", text)
    if named_match:
        day, month_name, year = named_match.groups()
        month = MONTHS.get(month_name.lower())
        if month:
            try:
                return date(int(year), month, int(day)).isoformat()
            except ValueError:
                return None
    return None


def parse_soil_report_text(text: str) -> dict:
    """Parse common labeled result rows without guessing or unit conversion."""
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    extraction = {field: _extract_field(lines, field) for field in FIELD_PATTERNS}
    extraction["soilTestDate"] = _extract_date(text)
    return extraction


def extract_soil_report_pdf(contents: bytes) -> dict:
    """Extract selectable PDF text; scanned/image-only PDFs return no readings."""
    if not contents.startswith(b"%PDF-"):
        raise ValueError("The uploaded file is not a PDF.")
    try:
        reader = PdfReader(BytesIO(contents), strict=False)
        if reader.is_encrypted:
            return {"textAvailable": False, "extraction": parse_soil_report_text("")}
        if len(reader.pages) > 30:
            raise ValueError("Soil reports may contain no more than 30 pages.")
        text = "\n".join(page.extract_text() or "" for page in reader.pages)
    except ValueError:
        raise
    except Exception as error:
        raise ValueError("Could not read this PDF. It may be damaged or password protected.") from error

    extraction = parse_soil_report_text(text)
    has_readings = any(item["value"] is not None for field, item in extraction.items() if field != "soilTestDate")
    return {"textAvailable": bool(text.strip()), "hasReadings": has_readings, "extraction": extraction}
