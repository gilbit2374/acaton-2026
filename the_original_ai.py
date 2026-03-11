import joblib
import os
import csv
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import Pipeline, FeatureUnion
from sklearn.model_selection import train_test_split

MODEL_FILENAME = 'toxic_model_v2.pkl'
DATA_FILENAME = 'dataset.csv'


def clean_hebrew_text(text):
    replacements = {"?": " ", "!": " !", ".": " ", ",": " "}
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)
    return text.lower().strip()


def build_smart_pipeline():

    word_vectorizer = TfidfVectorizer(
        analyzer='word',
        ngram_range=(1, 3),
        max_features=5000,
        sublinear_tf=True
    )

    char_vectorizer = TfidfVectorizer(
        analyzer='char_wb',
        ngram_range=(2, 5),
        max_features=5000,
        sublinear_tf=True
    )

    features = FeatureUnion([
        ('word_features', word_vectorizer),
        ('char_features', char_vectorizer)
    ])

    classifier = LogisticRegression(class_weight='balanced', solver='liblinear')

    pipeline = Pipeline([
        ('features', features),
        ('classifier', classifier)
    ])

    return pipeline



def train_and_save():
    texts, labels = [], []
    if not os.path.exists(DATA_FILENAME):
        init_dataset()

    with open(DATA_FILENAME, mode='r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        for row in reader:
            texts.append(clean_hebrew_text(row['text']))
            labels.append(row['label'])

    if len(set(labels)) < 2:
        print("⚠️ חסר מידע: צריך לפחות דוגמה אחת ל-toxic ואחת ל-clean.")
        return

    model = build_smart_pipeline()
    model.fit(texts, labels)

    joblib.dump(model, MODEL_FILENAME)
    print(f"🚀 המודל שודרג! אומן על {len(texts)} דוגמאות עם שילוב Word/Char N-grams.")


def predict(text):
    if not os.path.exists(MODEL_FILENAME):
        return None, None

    loaded_model = joblib.load(MODEL_FILENAME)
    clean_text = clean_hebrew_text(text)

    prediction = loaded_model.predict([clean_text])[0]
    probabilities = loaded_model.predict_proba([clean_text])[0]

    classes = loaded_model.classes_.tolist()
    toxic_index = classes.index('toxic') if 'toxic' in classes else 0

    return prediction, probabilities[toxic_index]



def init_dataset():
    if not os.path.exists(DATA_FILENAME):
        with open(DATA_FILENAME, mode='w', newline='', encoding='utf-8') as file:
            writer = csv.writer(file)
            writer.writerow(['text', 'label'])
            # דוגמאות בסיסיות להתחלה
            initial_data = [
                ('אתה איש רע מאוד', 'toxic'),
                ('אני אוהב אותך', 'clean'),
                ('לך מפה יא אפס', 'toxic'),
                ('בוקר טוב לכולם', 'clean')
            ]
            writer.writerows(initial_data)


def chat():
    THRESHOLD = 0.65  # סף רגישות
    print(f"\n--- צ'אט AI חכם (סף: {THRESHOLD * 100}%) ---")
    while True:
        x = input("Message: ")
        if x.lower() in ['exit', 'quit', 'יציאה']: break

        res, prob = predict(x)
        if res is None:
            print("המערכת לא מאומנת.");
            break

        if prob >= THRESHOLD:
            print(f"🚫 [נחסם] ביטחון רעילות: {prob:.2%}")
        else:
            print(f"✅ [אושר] {x} (מדד רעילות: {prob:.2%})")


if __name__ == "__main__":
    init_dataset()
    x= input("enter a number between 1-3:\n")
    while True:
        if x=="1":
            chat()
        if x=="2":
            train_and_save()
        if x=="exit":
            break