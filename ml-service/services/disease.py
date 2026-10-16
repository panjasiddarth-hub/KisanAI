from __future__ import annotations

from collections.abc import Mapping, Sequence


SYMPTOM_LABELS = {
	"yellowing": "Yellowing of leaves",
	"brown_spots": "Brown / black spots",
	"powdery_white": "White powdery coating",
	"wilting": "Wilting / drooping",
	"holes": "Holes in leaves / bolls",
	"curling": "Leaf curling / cupping",
	"rust_pustules": "Rust-coloured pustules",
	"black_rot": "Blackening / rot",
	"stunting": "Stunted growth",
	"mosaic": "Mosaic / mottled pattern",
	"leaf_blight": "Blight (rapid drying)",
	"boll_damage": "Damaged bolls / fruits",
	"water_soaked": "Water-soaked lesions",
	"premature_drop": "Premature dropping",
	"silver_streaks": "Silvery streaks",
}

DISEASE_SIGNATURES = {
	"cotton": [
		("Pink Bollworm", "Pest (Pectinophora gossypiella)", ("holes", "boll_damage", "premature_drop")),
		("Cotton Leaf Curl Virus (CLCuV)", "Virus (whitefly-vector)", ("curling", "yellowing", "stunting")),
		("Alternaria Leaf Spot", "Fungus (Alternaria macrospora)", ("brown_spots", "leaf_blight", "premature_drop")),
		("Fusarium Wilt", "Fungus (Fusarium oxysporum)", ("wilting", "yellowing", "premature_drop")),
	],
	"tomato": [
		("Early Blight", "Fungus (Alternaria solani)", ("brown_spots", "leaf_blight", "yellowing")),
		("Tomato Leaf Curl Virus (ToLCV)", "Virus (whitefly-vector)", ("curling", "yellowing", "mosaic", "stunting")),
		("Late Blight", "Oomycete (Phytophthora infestans)", ("water_soaked", "leaf_blight", "black_rot")),
	],
	"wheat": [
		("Brown / Yellow Rust", "Fungus (Puccinia spp.)", ("rust_pustules", "yellowing")),
		("Powdery Mildew", "Fungus (Blumeria graminis)", ("powdery_white", "yellowing", "stunting")),
		("Leaf Blight (Bipolaris)", "Fungus", ("leaf_blight", "brown_spots")),
	],
	"onion": [
		("Purple Blotch", "Fungus (Alternaria porri)", ("brown_spots", "leaf_blight", "water_soaked")),
		("Thrips", "Pest (Thrips tabaci)", ("silver_streaks", "curling", "stunting")),
	],
	"paddy": [
		("Rice Blast", "Fungus (Magnaporthe oryzae)", ("brown_spots", "leaf_blight")),
		("Bacterial Leaf Blight", "Bacteria (Xanthomonas oryzae)", ("water_soaked", "yellowing", "leaf_blight")),
		("Yellow Stem Borer", "Pest (Scirpophaga incertulas)", ("holes", "stunting", "wilting")),
	],
	"soybean": [
		("Yellow Mosaic Virus", "Virus (whitefly-vector)", ("mosaic", "yellowing", "curling")),
		("Soybean Rust", "Fungus (Phakopsora pachyrhizi)", ("rust_pustules", "brown_spots", "premature_drop")),
	],
	"sugarcane": [
		("Red Rot", "Fungus (Colletotrichum falcatum)", ("black_rot", "wilting", "yellowing")),
		("Early Shoot Borer", "Pest (Chilo infuscatellus)", ("holes", "stunting", "premature_drop")),
	],
}


def _crop_key(crop: str) -> str | None:
	normalized = crop.strip().lower()
	if "paddy" in normalized or "rice" in normalized:
		return "paddy"
	return next((key for key in DISEASE_SIGNATURES if key in normalized), None)


def predict_disease(data: Mapping[str, object]) -> dict[str, object]:
	crop = str(data.get("crop", "")).strip()
	symptoms = data.get("symptoms", [])
	if not crop:
		raise ValueError("crop is required")
	if not isinstance(symptoms, Sequence) or isinstance(symptoms, (str, bytes)):
		raise ValueError("symptoms must be a list of symptom IDs")

	selected = {str(symptom) for symptom in symptoms if str(symptom)}
	if not selected:
		raise ValueError("Select at least one symptom")

	key = _crop_key(crop)
	if key is None:
		supported = ", ".join(DISEASE_SIGNATURES)
		raise ValueError(f'No disease knowledge base for "{crop}" yet. Supported: {supported}.')

	ranked = []
	for name, pathogen, signature in DISEASE_SIGNATURES[key]:
		matched = [symptom for symptom in signature if symptom in selected]
		confidence = round(
			(len(matched) / len(signature) * 70)
			+ (len(matched) / len(selected) * 30)
		)
		ranked.append({
			"name": name,
			"pathogen": pathogen,
			"confidence": min(96, max(8, confidence)),
			"matchedSymptoms": [SYMPTOM_LABELS.get(symptom, symptom) for symptom in matched],
			"unmatchedSignature": [
				SYMPTOM_LABELS.get(symptom, symptom)
				for symptom in signature
				if symptom not in selected
			],
			"_score": confidence,
		})

	ranked.sort(key=lambda item: item["_score"], reverse=True)
	recommendations = [
		{key: value for key, value in diagnosis.items() if key != "_score"}
		for diagnosis in ranked[:3]
	]
	return {
		"crop": crop,
		"prediction": recommendations[0]["name"],
		"recommendations": recommendations,
		"modelSource": "symptom_signature_rules",
		"disclaimer": (
			"Rule-based advisory only. For severe outbreaks, consult your local "
			"agriculture officer or KVK scientist before spraying."
		),
	}
