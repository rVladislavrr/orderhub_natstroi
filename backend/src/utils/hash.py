import hashlib

def create_hash(data: str) -> str:
    return hashlib.sha256(data.encode('utf-8')).hexdigest()

def calculate_file_hash(file_content: bytes) -> str:
    hash_func = hashlib.new('sha256')
    hash_func.update(file_content)
    return hash_func.hexdigest()
