%% -*- mode: erlang -*-
%% -*- erlang-indent-level: 4;indent-tabs-mode: nil -*-
%% ex: ts=4 sw=4 et
%% Copyright 2011 Benjamin Nortier
%%
%%   Licensed under the Apache License, Version 2.0 (the "License");
%%   you may not use this file except in compliance with the License.
%%   You may obtain a copy of the License at
%%
%%       http://www.apache.org/licenses/LICENSE-2.0
%%
%%   Unless required by applicable law or agreed to in writing, software
%%   distributed under the License is distributed on an "AS IS" BASIS,
%%   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
%%   See the License for the specific language governing permissions and
%%   limitations under the License.

-module(api_stl_utils).
-author('Benjamin Nortier <bjnortier@shapesmith.net>').
-export([binary_to_ascii/1, coarsen/1]).

binary_to_ascii(Contents) ->
    <<_Header:80/binary, N:32/little-integer, Rest/binary>> = Contents,
    Triangles = triangles(N, [], Rest),
    iolist_to_binary("solid shapesmith_solid\n" ++ lists:map(fun to_facet/1, Triangles) ++ "endsolid shapesmith_solid\n").


triangles(0, Acc, _) ->
    Acc;
triangles(N, Acc, <<Nx:32/little-float, Ny:32/little-float, Nz:32/little-float, 
                    V1x:32/little-float, V1y:32/little-float, V1z:32/little-float, 
                    V2x:32/little-float, V2y:32/little-float, V2z:32/little-float, 
                    V3x:32/little-float, V3y:32/little-float, V3z:32/little-float, 
                    _:16/integer,
                    Rest/binary>>) ->
    triangles(N-1, [{{Nx, Ny, Nz}, {V1x, V1y, V1z}, {V2x, V2y, V2z}, {V3x, V3y, V3z}}|Acc], Rest).


to_facet({{Nx, Ny, Nz}, {V1x, V1y, V1z}, {V2x, V2y, V2z}, {V3x, V3y, V3z}}) ->
    io_lib:format("facet normal ~e ~e ~e\nouter loop\nvertex ~e ~e ~e\nvertex ~e ~e ~e\nvertex ~e ~e ~e\nendloop\nendfacet\n",
                  [Nx, Ny, Nz, V1x, V1y, V1z, V2x, V2y, V2z, V3x, V3y, V3z]).

coarsen(Stl) ->
    process_flag(trap_exit, true),
    try 
        Gts = stdio_command("stl2gts", binary_to_list(Stl)),
        lager:info("Coarsening STL..."),
        Coarse = stdio_command("coarsen", ["-n 2000"], Gts ++ "\r\n"),
        Stl2 = stdio_command("gts2stl", Coarse ++ "\r\n"),
        iolist_to_binary(Stl2)
    catch
        Err:Reason ->
            lager:warning("STL coarsening not available: ~p:~p", [Err, Reason]),
            Stl
    end.

stdio_command(Command, Data) ->
    stdio_command(Command, [], Data).

stdio_command(Command, Args, Data) ->
    case os:find_executable(Command) of
        false -> 
            throw({not_found, Command});
        FullCommand ->
            Port = open_port({spawn_executable, FullCommand}, [{args, Args},
                                                               stream,
                                                               use_stdio]),
            Port ! {self(), {command, Data}},
            concatenate(Port, Command, [])
    end.

concatenate(Port, Command, Acc) ->
    receive
        {Port, {data, Result}} ->
            concatenate(Port, Command, Acc ++ Result);
        {'EXIT', Port, normal} ->
            Acc
    after 5000 ->
            throw({no_response, Command})
    end.
