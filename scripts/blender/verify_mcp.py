"""Verify the complete stdio MCP -> addon -> Blender connection.

Run: uv run --with mcp python scripts/blender/verify_mcp.py
"""
import asyncio, os
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    env=dict(os.environ,DISABLE_TELEMETRY='true',PYTHONIOENCODING='utf-8')
    parameters=StdioServerParameters(command=r'C:\Users\ondev\.local\bin\uvx.exe',args=['mcp-for-blender'],env=env)
    async with stdio_client(parameters) as (read,write):
        async with ClientSession(read,write) as session:
            info=await session.initialize()
            tool_list=await session.list_tools()
            print('MCP initialized:',info.model_dump(by_alias=True)['serverInfo']['name'])
            print('Tools:',len(tool_list.tools))
            target=next(t for t in tool_list.tools if t.name=='get_scene_info')
            result=await session.call_tool(target.name,{})
            failed=result.model_dump(by_alias=True).get('isError',False)
            print('Blender scene query:', 'ERROR' if failed else 'SUCCESS')
            for content in result.content:
                if hasattr(content,'text'):print(content.text[:1600])
            if failed:raise RuntimeError('Blender scene query failed')

asyncio.run(main())
