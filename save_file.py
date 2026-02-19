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
    """יוצר את קובץ הנתונים אם הוא לא קיים, ומכניס קצת נתונים התחלתיים."""
    if not os.path.exists(DATA_FILENAME):
        with open(DATA_FILENAME, mode='w', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerow(['text', 'label'])  # כותרות העמודות
            # נתונים התחלתיים לדוגמה
            writer.writerow(['אתה אפס', 'toxic'])
            writer.writerow(['איזה מלך אתה', 'clean'])
        print("✅ קובץ נתונים חדש נוצר בהצלחה!")
        train_and_save()  # אימון ראשוני


def add_new_data(text, label):
    """מוסיף משפט חדש לקובץ הנתונים ומאמן את המודל מחדש."""
    with open(DATA_FILENAME, mode='a', newline='', encoding='utf-8') as file:
        writer = csv.writer(file)
        writer.writerow([text, label])

    print(f"✅ המשפט התווסף למאגר כ-'{label}'!")
    # אחרי שהוספנו דאטה, נאמן את המודל מחדש כדי שיהפוך לחכם יותר
    train_and_save()


# --- 2. אימון וחיזוי ---

def train_and_save():
    """קורא את כל הנתונים מקובץ ה-CSV, מאמן את המודל ושומר אותו."""
    texts = []
    labels = []

    # קריאת הנתונים מהקובץ
    with open(DATA_FILENAME, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            texts.append(row['text'])
            labels.append(row['label'])

    # יצירת המודל ואימון
    model = make_pipeline(TfidfVectorizer(), MultinomialNB())
    model.fit(texts, labels)

    # שמירה
    joblib.dump(model, MODEL_FILENAME)
    print(f"🧠 המודל אומן מחדש על {len(texts)} משפטים ונשמר בהצלחה!")


def predict(text):
    """טוען את המודל ומנבא."""
    if not os.path.exists(MODEL_FILENAME):
        return "❌ שגיאה: המודל לא נמצא."

    loaded_model = joblib.load(MODEL_FILENAME)
    return loaded_model.predict([text])[0]









def chat():
    while True:
        x=input("try to enter a chat message: ")
        if predict(x) =="clean":
            print(f"📌 סיווג: {predict(x)}")
        else:
            print("המילה נמחקה כי היא עברה על גבולות האפליקציה")

# --- 3. ממשק משתמש (תפריט) ---

if __name__ == "__main__":
    init_dataset()  # מוודא שקובץ הנתונים קיים

    while True:
        print("\n--- 🤖 בוט זיהוי שפה פוגענית ---")
        print("1. בדוק משפט (חיזוי)")
        print("2. למד את המודל משפט פוגעני חדש (Toxic)")
        print("3. למד את המודל משפט תקין חדש (Clean)")
        print("4. יציאה")
        print("5. אימון המודל לפי הcsv file")

        choice = input("בחר אפשרות (1-5): ")

        if choice == '1':
            #text = input("הכנס משפט לבדיקה: ")
            #print(f"📌 סיווג: {predict(text)}")
            chat()

        elif choice == '2':
            text = input("הכנס משפט פוגעני חדש: ")
            add_new_data(text, "toxic")

        elif choice == '3':
            text = input("הכנס משפט תקין חדש: ")
            add_new_data(text, "clean")

        elif choice == '4':
            print("להתראות!")
            break
        elif choice == '5':
            train_and_save()
        else:
            print("❌ בחירה לא חוקית, נסה שוב.")
