from chatlib.tool.converter import yaml_str_to_dict_converter
from py_core.system.task.card_recommendation.common import ChildCardRecommendationAPIResult
print('Starting test parse')

s='''```yaml
topics:
  - Pleasant Goat
  - Wolf
  - Adventure
  - Friends
actions:
  - Play
  - Run
  - Help
  - Laugh
emotions:
  - Happy
  - Glad
  - Surprised
  - Delighted
```'''
try:
    d=yaml_str_to_dict_converter(s,None)
    print('YAML dict:', d)
    obj=ChildCardRecommendationAPIResult(**d)
    print('Parsed OK:', obj)
except Exception as e:
    print('Error:', e)
