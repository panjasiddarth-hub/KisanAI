import unittest

from services.soil_report import parse_soil_report_text


class SoilReportTextTests(unittest.TestCase):
    def test_reads_labeled_values_without_converting_report_units(self):
        text = """
        SOIL TEST REPORT
        Report date
        20 October 2026
        LABORATORY RESULTS
        Soil pH
        6.4
        pH units
        Electrical conductivity
        0.34
        dS/m
        Organic carbon
        0.62
        %
        Available nitrogen
        280
        kg/ha
        Available phosphorus (P2O5)
        22
        kg/ha
        Available potassium (K2O)
        265
        kg/ha
        Sulphur
        13
        mg/kg
        Zinc
        0.72
        mg/kg
        Iron
        4.1
        mg/kg
        Manganese
        2.8
        mg/kg
        Copper
        0.46
        mg/kg
        Boron
        0.48
        mg/kg
        """

        result = parse_soil_report_text(text)

        self.assertEqual(result["soilPH"], {"value": 6.4, "unit": "pH", "confidence": "high"})
        self.assertEqual(result["soilEC"]["value"], 0.34)
        self.assertEqual(result["soilOC"]["value"], 0.62)
        self.assertEqual(result["soilN"]["value"], 280)
        self.assertEqual(result["soilP"]["value"], 22)
        self.assertIn("P2O5", result["soilP"]["unit"])
        self.assertIn("K2O", result["soilK"]["unit"])
        self.assertEqual(result["soilS"]["unit"], "mg/kg")
        self.assertEqual(result["soilZn"]["value"], 0.72)
        self.assertEqual(result["soilFe"]["value"], 4.1)
        self.assertEqual(result["soilMn"]["value"], 2.8)
        self.assertEqual(result["soilCu"]["value"], 0.46)
        self.assertEqual(result["soilB"]["value"], 0.48)
        self.assertEqual(result["soilTestDate"], "2026-10-20")

    def test_leaves_unreadable_values_blank_instead_of_guessing(self):
        result = parse_soil_report_text("Soil pH\nunclear\nNitrogen\nnot legible")
        self.assertIsNone(result["soilPH"]["value"])
        self.assertIsNone(result["soilN"]["value"])
        self.assertIsNone(result["soilTestDate"])


if __name__ == "__main__":
    unittest.main()
