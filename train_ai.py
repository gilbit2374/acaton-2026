import pandas as pd
import numpy as np
import torch
from sklearn.model_selection import train_test_split
from sklearn.metrics import f1_score, accuracy_score, precision_recall_fscore_support
from sklearn.utils.class_weight import compute_class_weight
from transformers import (
    BertForSequenceClassification,
    Trainer,
    TrainingArguments,
    AutoTokenizer,
    EarlyStoppingCallback
)

# 1. טעינה ואיזון נתונים
print("🔄 טוען נתונים ומכין אימון עומק...")
df = pd.read_csv('dataset.csv').dropna(subset=['text', 'label'])
mapping = {'toxic': 1, 'clean': 0}
df['label'] = df['label'].str.strip().map(mapping)

# 2. הכנת הטוקנייזר (שימוש ב-128 טוקנים להקשר רחב)
model_name = "avichr/heBERT"
tokenizer = AutoTokenizer.from_pretrained(model_name)

train_texts, val_texts, train_labels, val_labels = train_test_split(
    df['text'].tolist(), df['label'].tolist(), test_size=0.15, random_state=42, stratify=df['label']
)

class HebrewDataset(torch.utils.data.Dataset):
    def __init__(self, texts, labels, tokenizer):
        self.encodings = tokenizer(texts, padding="max_length", truncation=True, max_length=128)
        self.labels = labels
    def __getitem__(self, idx):
        item = {key: torch.tensor(val[idx]) for key, val in self.encodings.items()}
        item['labels'] = torch.tensor(self.labels[idx], dtype=torch.long)
        return item
    def __len__(self): return len(self.labels)

train_dataset = HebrewDataset(train_texts, train_labels, tokenizer)
val_dataset = HebrewDataset(val_texts, val_labels, tokenizer)

# 3. פונקציית חישוב מדדים (כאן נמדדת ה"גאונות" של המודל)
def compute_metrics(pred):
    labels = pred.label_ids
    preds = pred.predictions.argmax(-1)
    precision, recall, f1, _ = precision_recall_fscore_support(labels, preds, average='binary')
    acc = accuracy_score(labels, preds)
    return {'accuracy': acc, 'f1': f1, 'precision': precision, 'recall': recall}

# 4. טיפול בחוסר איזון
weights = compute_class_weight('balanced', classes=np.unique(train_labels), y=train_labels)
class_weights = torch.tensor(weights, dtype=torch.float)

class WeightedTrainer(Trainer):
    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        labels = inputs.get("labels")
        outputs = model(**inputs)
        logits = outputs.get("logits")
        loss_fct = torch.nn.CrossEntropyLoss(weight=class_weights.to(model.device))
        return (loss_fct(logits.view(-1, self.model.config.num_labels), labels.view(-1)), outputs) if return_outputs else loss_fct(logits.view(-1, self.model.config.num_labels), labels.view(-1))

# 5. הגדרות אימון ברמה הגבוהה ביותר
model = BertForSequenceClassification.from_pretrained(model_name, num_labels=2)

training_args = TrainingArguments(
    output_dir='./results',
    num_train_epochs=15,              # יותר איטרציות, אבל עם עצירה מוקדמת אם זה מספיק
    per_device_train_batch_size=16,   # באצ' קטן יותר לעיתים עוזר להכללה (Generalization) טובה יותר
    per_device_eval_batch_size=64,
    warmup_ratio=0.1,                 # 10% מהזמן למידה הדרגתית
    weight_decay=0.05,                # רגולריזציה חזקה למניעת שינון
    logging_dir='./logs',
    eval_strategy="epoch",
    save_strategy="epoch",
    load_best_model_at_end=True,      # בסוף נשמור את הגרסה הכי חכמה, לא הכי אחרונה
    metric_for_best_model="f1",       # המודל הכי טוב הוא זה עם ה-F1 הכי גבוה
    fp16=True,                        # שימוש בליבות Tensor של ה-3060
    learning_rate=2e-5,               # קצב למידה יציב יותר
    save_total_limit=2                # חוסך מקום בדיסק
)

trainer = WeightedTrainer(
    model=model,
    args=training_args,
    train_dataset=train_dataset,
    eval_dataset=val_dataset,
    compute_metrics=compute_metrics,
    callbacks=[EarlyStoppingCallback(early_stopping_patience=3)] # אם 3 תקופות אין שיפור - תעצור
)

print("🚀 מתחיל אימון אופטימלי (Best-in-class training)...")
trainer.train()

model.save_pretrained("./my_toxic_model")
tokenizer.save_pretrained("./my_toxic_model")
print("\n👑 המודל המשודרג מוכן!")