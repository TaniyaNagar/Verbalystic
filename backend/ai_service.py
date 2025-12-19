from transformers import pipeline

# Load model once (on startup)
grammar_corrector = pipeline(
    "text2text-generation",
    model="vennify/t5-base-grammar-correction"
)

def generate_ai_improved_transcript(transcript: str, user_id: str):
    if not transcript or len(transcript.split()) < 15:
        return None

    try:
        result = grammar_corrector(
            "grammar: " + transcript,
            max_length=512,
            do_sample=False
        )
        return result[0]["generated_text"]
    except Exception as e:
        print("AI error:", e)
        return None
