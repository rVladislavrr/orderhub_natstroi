import strawberry
from src.graphql.resolvers import Query

schema = strawberry.Schema(query=Query)