from flask import  *

app = Flask(__name__)

@app.route("/")
def home():
    return render_template("index.html")
@app.route("/about")
def about():
    return render_template("redNote-website/frontend/redNote.html")





app.run()