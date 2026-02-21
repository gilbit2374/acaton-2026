from transformers import pipeline
model_path = "./my_toxic_model"
try:
    # טעינת המודל
    pipe = pipeline("text-classification", model=model_path, tokenizer=model_path)
    print("--- המערכת מוכנה! (כתוב 'יציאה' לסיום) ---")
except Exception as e:
    print(f"שגיאה בטעינה: {e}")
    exit()

    # שליפת הציונים בצורה בטוחה
    scores = {res['label']: res['score'] for res in results}
    toxic_score = scores.get('LABEL_1', 0)
    clean_score = scores.get('LABEL_0', 0)

def check_chat(user_input):
    if user_input.lower() in ['יציאה', 'exit', 'quit']: return
    if not user_input.strip(): return

    # שימוש ב-top_k=None מחזיר את כל הלייבלים בצורה מסודרת
    results = pipe(user_input, top_k=None)

    # שליפת הציונים בצורה בטוחה
    scores = {res['label']: res['score'] for res in results}
    toxic_score = scores.get('LABEL_1', 0)
    clean_score = scores.get('LABEL_0', 0)

    # סף רגישות נמוך כדי לתפוס קללות "מוחבאות"
    threshold = 0.15

    if toxic_score > threshold:
        print(f"בוט: המשפט הזה נראה לי רעיל / קללה 😡")
        print(f"🔍 רמת רעילות שזוהתה: {toxic_score * 100:.1f}%")
        if clean_score > 0.5:
            print("💡 שים לב: המודל זיהה קללה למרות שיש במשפט גם מילים חיוביות.")
    else:
        print(f"בוט: המשפט הזה נראה לי נקי ✨ (ביטחון: {clean_score * 100:.1f}%)")
x= input("enter a message: ")
check_chat(x)
