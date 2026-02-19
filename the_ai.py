import joblib
import os
import csv
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import make_pipeline

MODEL_FILENAME = 'toxic_model.pkl'
DATA_FILENAME = 'dataset.csv'


# --- 1. ניהול הנתונים בקובץ CSV ---

def init_dataset():
    if not os.path.exists(DATA_FILENAME):
        with open(DATA_FILENAME, mode='w', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerow(['text', 'label'])
            writer.writerow(['אתה אפס', 'toxic'])
            writer.writerow(['איזה מלך אתה', 'clean'])
        print("✅ קובץ נתונים חדש נוצר בהצלחה!")
        train_and_save()


def add_new_data(text, label):
    with open(DATA_FILENAME, mode='a', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow([text, label])
    print(f"✅ המשפט התווסף למאגר כ-'{label}'!")
    train_and_save()


# --- 2. אימון וחיזוי ---

def train_and_save():
    texts = []
    labels = []

    if not os.path.exists(DATA_FILENAME):
        print("❌ שגיאה: קובץ הנתונים לא נמצא.")
        return

    with open(DATA_FILENAME, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            texts.append(row['text'])
            labels.append(row['label'])

    if len(set(labels)) < 2:
        print("⚠️ אזהרה: צריך לפחות דוגמה אחת מכל סוג (toxic ו-clean) כדי לאמן.")
        return

    # --- השיפור המשמעותי כאן ---
    # analyzer='char_wb' מאפשר לזהות עקיפות כמו א.פ.ס
    # ngram_range=(2, 5) מסתכל על רצפי אותיות
    vectorizer = TfidfVectorizer(analyzer='char_wb', ngram_range=(2, 5))
    model = make_pipeline(vectorizer, MultinomialNB())

    model.fit(texts, labels)

    joblib.dump(model, MODEL_FILENAME)
    print(f"🧠 המודל אומן מחדש על {len(texts)} שורות ונשמר בהצלחה!")


def predict(text):
    if not os.path.exists(MODEL_FILENAME):
        return "❌ שגיאה: המודל לא נמצא."

    loaded_model = joblib.load(MODEL_FILENAME)
    # שימוש ב-predict_proba מאפשר לראות עד כמה המודל בטוח
    prediction = loaded_model.predict([text])[0]
    probability = loaded_model.predict_proba([text])[0]
    return prediction,probability


def chat():
    # הגדרת סף הרגישות - אפשר לשנות את זה לפי כמה "קשוח" אתה רוצה שהבוט יהיה
    THRESHOLD = 0.7

    print(f"\n--- מצב צ'אט פעיל (סף חסימה: {THRESHOLD * 100}%) ---")
    while True:
        x = input("Message: ")
        if x.lower() == 'exit':
            break

        result, probability = predict(x)

        # sklearn מחזיר את ההסתברויות לפי סדר האלף-בית של ה-labels
        # אם ה-labels שלך הם ['clean', 'toxic'], אז אינדקס 0 זה clean ואינדקס 1 זה toxic
        # נניח ש-labels הם במערך של המודל:
        classes = joblib.load(MODEL_FILENAME).classes_.tolist()
        toxic_index = classes.index('toxic')
        toxic_prob = probability[toxic_index]

        if toxic_prob >= THRESHOLD:
            print(f"🚫 ההודעה נמחקה! (ביטחון רעילות: {toxic_prob * 100:.2f}%)")
        else:
            # גם אם המודל חשב שזה toxic אבל בביטחון נמוך מהסף, אנחנו מאשרים
            print(f"📌 {x} (אושר - ביטחון רעילות נמוך: {toxic_prob * 100:.2f}%)")


# --- 3. ממשק משתמש ---

if __name__ == "__main__":
    init_dataset()

    while True:
        print("\n--- 🤖 בוט זיהוי שפה פוגענית ---")
        print("1. בדוק משפט (חיזוי/צ'אט)")
        print("2. למד את המודל משפט פוגעני (Toxic)")
        print("3. למד את המודל משפט תקין (Clean)")
        print("4. אימון המודל מחדש מהקובץ")
        print("5. יציאה")

        choice = input("בחר אפשרות (1-5): ")

        if choice == '1':
            chat()
        elif choice == '2':
            text = input("הכנס משפט פוגעני חדש: ")
            add_new_data(text, "toxic")
        elif choice == '3':
            text = input("הכנס משפט תקין חדש: ")
            add_new_data(text, "clean")
        elif choice == '4':
            train_and_save()
        elif choice == '5':
            print("להתראות!")
            break
        else:
            print("❌ בחירה לא חוקית.")