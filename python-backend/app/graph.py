from langgraph.graph import END, StateGraph

from .nodes import PlanNodes
from .state import PlanGraphState


def build_plan_graph(nodes: PlanNodes):
    graph = StateGraph(PlanGraphState)
    graph.add_node("normalize_inputs", nodes.normalize_inputs)
    graph.add_node("analyze_program", nodes.analyze_program)
    graph.add_node("analyze_company", nodes.analyze_company)
    graph.add_node("build_outline", nodes.build_outline)
    graph.add_node("generate_sections", nodes.generate_sections)
    graph.add_node("compile_output", nodes.compile_output)

    graph.set_entry_point("normalize_inputs")
    graph.add_edge("normalize_inputs", "analyze_program")
    graph.add_edge("analyze_program", "analyze_company")
    graph.add_edge("analyze_company", "build_outline")
    graph.add_edge("build_outline", "generate_sections")
    graph.add_edge("generate_sections", "compile_output")
    graph.add_edge("compile_output", END)

    return graph.compile()
