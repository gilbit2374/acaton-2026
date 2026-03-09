import os
from optimum.onnxruntime import ORTModelForSequenceClassification
from transformers import AutoTokenizer

# הנתיבים שלך
model_path = r"/my_toxic_model"
output_path = "redNote-website/frontend/model_web"

print(f"טוען וממיר את המודל מ: {model_path}...")

try:
    # טעינה וייצוא אוטומטי ל-ONNX בעזרת Optimum
    # זה פותר את כל בעיות ה-TracerWarning שראית
    model = ORTModelForSequenceClassification.from_pretrained(model_path, export=True)
    tokenizer = AutoTokenizer.from_pretrained(model_path)

    # שמירת התוצאה
    model.save_pretrained(output_path)
    tokenizer.save_pretrained(output_path)

    print(f"\n✅ הצלחה! התיקייה '{output_path}' מוכנה לשימוש באתר.")
    print(f"הנתיב המלא: {os.path.abspath(output_path)}")

except Exception as e:
    print(f"\n❌ שגיאה בתהליך: {e}")