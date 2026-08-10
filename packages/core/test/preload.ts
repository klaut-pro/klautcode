import path from "path"

process.env.KLAUTCODE_DB = ":memory:"
process.env.KLAUTCODE_MODELS_PATH = path.join(import.meta.dir, "plugin", "fixtures", "models-dev.json")
process.env.KLAUTCODE_DISABLE_MODELS_FETCH = "true"
