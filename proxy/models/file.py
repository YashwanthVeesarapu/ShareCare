from pydantic import BaseModel

class CheckRequest(BaseModel):
    paths: list[str]  # ["my-folder/a.png", "docs/foo.pdf", ...]