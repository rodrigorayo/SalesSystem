from beanie import Document

# Compatibilidad entre distintas versiones de Beanie (get_pymongo_collection vs get_motor_collection)
if not hasattr(Document, "get_pymongo_collection") and hasattr(Document, "get_motor_collection"):
    @classmethod
    def get_pymongo_collection(cls):
        return cls.get_motor_collection()
    Document.get_pymongo_collection = get_pymongo_collection
elif not hasattr(Document, "get_motor_collection") and hasattr(Document, "get_pymongo_collection"):
    @classmethod
    def get_motor_collection(cls):
        return cls.get_pymongo_collection()
    Document.get_motor_collection = get_motor_collection
