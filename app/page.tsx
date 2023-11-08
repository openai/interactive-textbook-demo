"use client";

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/components/ui/use-toast";
import { CheckedState } from "@radix-ui/react-checkbox";
import { createChunkDecoder } from "ai";
import { filter, join, trim } from "lodash";
import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react"

export default function Home() {
  const [selectedText, setSelectedText] = useState("");
  
  const [explainLoading, setExplainLoading] = useState<"eli5"|"summary"|"poem"|null>(null);
  const [explainCompletion, setExplainCompletion] = useState("");
  const [currentExplainAction, setCurrentExplainAction] = useState<"eli5"|"summary"|"poem"|null>(null);

  const [language, setLanguage] = useState("Japanese")
  const [translateLoading, setTranslateLoading] = useState(false);
  const [translation, setTranslation] = useState("");
  const [translationTTSLoading, setTranslationTTSLoading] = useState(false);

  const [ttsMode, setTtsMode] = useState(false);
  const [describeImageIdxLoading, setDescribeImageIdxLoading] = useState(-1);
  const [describeImageText, setDescribeImageText] = useState("");

  const sectionIdxRef = useRef(0);

  const textbookRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLVideoElement>(null);
  const asyncIdRef = useRef<number|null>(null);

  const { dismiss, toast } = useToast();

  const clearDocument = () => {
    // Clear existing highlights
    const existingHighlights = Array.from(document.getElementsByClassName("highlight-wrapper"));
    for (let i = 0; i < existingHighlights.length; i++) {
      existingHighlights[i].replaceWith(...Array.from(existingHighlights[i].childNodes))
    }

    setExplainCompletion("");
    setCurrentExplainAction(null);
    setTranslation("");
    setDescribeImageText("");
    asyncIdRef.current = null;
    playerRef.current!.pause();
  }

  useEffect(() => {
    const highlightRange = (range: Range) => {
      const selectedWrapper = document.createElement("span");
      selectedWrapper.classList.add("bg-yellow-400", "highlight-wrapper");
      selectedWrapper.appendChild(range.extractContents());
      range.insertNode(selectedWrapper);
    }

    const handleMouseUp = () => {
      if (ttsMode) return;

      const textbookNode = textbookRef.current;

      const selection = document.getSelection();
      if (!selection?.anchorNode) return;
      if (!textbookNode?.contains(selection?.anchorNode)) return;
      
      clearDocument();

      if (selection) {
        // Get nodes to highlight
        const initialRange = selection.getRangeAt(0)
        const ancestor = initialRange.commonAncestorContainer;
        const ranges = [];

        const startNodes = [];
        if (initialRange.startContainer !== ancestor) {
          for (let node = initialRange.startContainer; node !== ancestor && node.parentNode !== null; node = node.parentNode) {
            startNodes.push(node);
          }
        }
        if (startNodes.length > 0) {
          for (let i = 0; i < startNodes.length; i++) {
            const range = document.createRange();
            if (i) {
              range.setStartAfter(startNodes[i - 1]);
              range.setEndAfter(startNodes[i].lastChild!);
            } else {
              range.setStart(startNodes[i], initialRange.startOffset);
              range.setEndAfter(
                (startNodes[i].nodeType == Node.TEXT_NODE) ?
                startNodes[i] :
                startNodes[i].lastChild!
              );
            }
            ranges.push(range);
          }
        }

        const endNodes = [];
        const re = [];
        if (initialRange.endContainer !== ancestor) {
          for (let node = initialRange.endContainer; node !== ancestor && node.parentNode !== null; node = node.parentNode) {
            endNodes.push(node);
          }
        }
        if (endNodes.length > 0) {
          for (let i = 0; i < endNodes.length; i++) {
            const range = document.createRange();
            if (i) {
              range.setStartBefore(endNodes[i].firstChild!);
              range.setEndBefore(endNodes[i - 1]);
            }
            else {
              range.setEnd(endNodes[i], initialRange.endOffset);
              range.setStartBefore(
                (endNodes[i].nodeType == Node.TEXT_NODE) ?
                endNodes[i] :
                endNodes[i].firstChild!
              );
            }
            re.unshift(range);
          }
        }

        let finalRanges = [];
        if ((startNodes.length > 0) && (endNodes.length > 0)) {
          const range = document.createRange();
          range.setStartAfter(startNodes[startNodes.length - 1]);
          range.setEndBefore(endNodes[endNodes.length - 1]);
          ranges.push(range);
          finalRanges = ranges.concat(re)
        } else {
          finalRanges = [initialRange]
        }

        const filteredRanges = filter(finalRanges, (range) => {
          return textbookNode.contains(range.startContainer);
        })

        for (let i = 0; i < filteredRanges.length; i++) {
          highlightRange(filteredRanges[i]);
        }

        const text = join(filteredRanges.map((range) => range.toString()), "\n");
        setSelectedText(trim(text));

        selection.removeAllRanges();
      } else {
        setSelectedText("");
      }
    }
    
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mouseup", handleMouseUp);
    }
  }, [ttsMode]);

  const handleExplainAction = useCallback(async (action: "eli5"|"summary"|"poem") => {
    setExplainLoading(action);
    setCurrentExplainAction(action);
    setExplainCompletion("");
    const resp = await fetch("/api/explain", {
      method: "POST",
      body: JSON.stringify({
        action,
        text: selectedText
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    if (resp.body) {
      const reader = resp.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const decoder = createChunkDecoder();
        setExplainCompletion((prevCompletion) => prevCompletion + decoder(value));
      }
    }

    setExplainLoading(null);
  }, [selectedText]);

  const handleTranslate = useCallback(async () => {
    setTranslateLoading(true);
    const resp = await fetch("/api/translate", {
      method: "POST",
      body: JSON.stringify({
        language,
        text: selectedText
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    let completion = "";

    if (resp.body) {
      const reader = resp.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }

        const decoder = createChunkDecoder();
        const decoded = decoder(value);
        completion += decoded
        setTranslation((prevCompletion) => prevCompletion + decoded);
      }
    }
    setTranslateLoading(false);

    return completion;
  }, [language, selectedText]);


  const getTTSResp = async (text: string) => {
    const resp = await fetch("/api/tts", {
      method: "POST",
      body: JSON.stringify({
        text,
      }),
      headers: {
        "Content-Type": "application/json",
      },
    });
    return resp;
  }

  const tts = useCallback(async (text: string, asyncId: number) => {
    if (asyncIdRef.current !== asyncId) return;

    const resp = await getTTSResp(text);

    if (resp.body) {  
      const reader = resp.body.getReader();

      const player = playerRef.current!;
      const mediaSource = new MediaSource();
      player.src = window.URL.createObjectURL(mediaSource);

      mediaSource.addEventListener("sourceopen", async () => {
        const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');
        player.play();

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }

          try {
            sourceBuffer.appendBuffer(value);
          } catch (_e) {
            // Ok with this failing 
          }
        }
      });
    }
  }, []);

  const handleReadTranslation = useCallback(async () => {
    setTranslationTTSLoading(true);
    let existingTranslation = translation;
    if (!existingTranslation) {
      existingTranslation = await handleTranslate();
    }
    asyncIdRef.current = Date.now()
    await tts(existingTranslation, asyncIdRef.current)
    setTranslationTTSLoading(false)
  }, [translation, handleTranslate, tts]);

  const handleLanguageInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLanguage(e.target.value);
  }

  const handleTtsModeChange = (checked: CheckedState) => {
    setTtsMode(checked as boolean)

    if (!checked) {
      const textbookContentElement = textbookRef.current;
      const children = Array.from(textbookContentElement?.children || []) as HTMLElement[];
      
      const nextSectionId = sectionIdxRef.current;
      children[nextSectionId - 1 === -1 ? children.length -1 : nextSectionId - 1].classList.remove("tts-highlight")
      sectionIdxRef.current = 0;
    } else {
      clearDocument();
    }
  }

  const describeImage = async (src: string, asyncId: number) => {
    setDescribeImageText("");

    if (asyncIdRef.current !== asyncId) return;

    const toDataURL = (url: string) => fetch(url)
      .then(response => response.blob())
      .then(blob => new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      }))

      const imgURL = await toDataURL(src) as string

      const resp = await fetch("/api/vision", {
        method: "POST",
        body: JSON.stringify({
          image64: imgURL.split("base64,")[1],
        }),
        headers: {
          "Content-Type": "application/json",
        },
      });

      let completion = ""
      if (resp.body) {
        const reader = resp.body.getReader();
        while (true) {
          if (asyncIdRef.current !== asyncId) {
            setDescribeImageText("");
            return;
          };

          const { done, value } = await reader.read();
          if (done) {
            break;
          }
  
          const decoder = createChunkDecoder();
          const decoded = decoder(value);
          completion += decoded
          setDescribeImageText((prevCompletion) => prevCompletion + decoded);
        }
      }

      return completion
  }

  const handleDescribeImageFromIdx = async (idx: number) => {
    clearDocument();

    setDescribeImageIdxLoading(idx);

    const imageElements = document.getElementsByTagName("img");
    const img = imageElements[idx];
    if (img) {
      asyncIdRef.current = Date.now();
      const description = await describeImage(img.src, asyncIdRef.current)

      if (description) {
        asyncIdRef.current = Date.now();
        await tts(description, asyncIdRef.current);
      }

    }
    setDescribeImageIdxLoading(-1);
  }

  useEffect(() => {
    const textbookContentElement = textbookRef.current;
    const children = Array.from(textbookContentElement?.children || []) as HTMLElement[];

    const handleTabPress = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !children?.length) return;
      
      e.preventDefault();

      const nextSectionId = sectionIdxRef.current;
      children[nextSectionId - 1 === -1 ? children.length -1 : nextSectionId - 1].classList.remove("tts-highlight")
      children[nextSectionId].classList.add("tts-highlight");
      children[nextSectionId].scrollIntoView();

      playerRef.current!.pause();
      asyncIdRef.current = null;
      setSelectedText("");

      if (children[nextSectionId].tagName === "IMG") {
        asyncIdRef.current = Date.now();
        children[nextSectionId].classList.add("animate-pulse");
        describeImage((children[nextSectionId] as HTMLImageElement).src, asyncIdRef.current).then((text) => {
          children[nextSectionId].classList.remove("animate-pulse");
          if (text) {
            asyncIdRef.current = Date.now();
            tts(text, asyncIdRef.current);
          }
        });
      } else {
        if (children[nextSectionId].textContent) {
          setSelectedText(children[nextSectionId].textContent!);

          asyncIdRef.current = Date.now()
          tts(children[nextSectionId].textContent!,  asyncIdRef.current);
        }
      }
      
      sectionIdxRef.current = (nextSectionId + 1) % children.length;
    }

    if (ttsMode) {
      clearDocument();
      document.addEventListener("keydown", handleTabPress)
    } else {
      clearDocument();
    }

    return () => {
      document.removeEventListener("keydown", handleTabPress)
    }
  }, [ttsMode, tts])

  useEffect(() => {
    const handlePlay = () => {
      toast({
        description: <div className="flex items-center"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Reading out loud...</div>,
        action: <ToastAction altText="Stop" onClick={clearDocument}>Stop</ToastAction>,
      })
    }

    const handlePause = () => {
      dismiss();
    }
 
    playerRef.current?.addEventListener("play", handlePlay);
    playerRef.current?.addEventListener("pause", handlePause);

    return () => {
      playerRef.current?.removeEventListener("play", handlePlay);
      playerRef.current?.removeEventListener("pause", handlePause);
    }
  }, [])

  return (
    <main className="min-h-screen">
      <video ref={playerRef} className="hidden"/>
      <div className="flex items-start justify-between space-x-12">
        <div className="w-1/2 flex flex-col h-screen overflow-hidden">
          <h1 className="pt-12 pb-6 pl-16">Interactive textbook demo</h1>
          <div className="pb-6 pl-16 text-xs">This is a very simple demo with a <a target="_blank" className="text-blue-400 hover:underline" href="https://nittygrittyscience.com/textbooks/animal-diversity-vertebrates/section-2-reptiles-birds/">static textbook page</a> to demonstrate how OpenAI{"'"}s technologies can be used to make it more accessible to people with visual disabilities or language and learning barriers.</div>
          <div className="overflow-y-scroll grow pl-16 mb-12 font-serif">
            <div className="border-gray-200 border rounded-lg py-5 px-6 flex flex-col" ref={textbookRef}>
              <h2 className="mb-6">Section 2: Reptiles & Birds</h2>
              <img src="/reptile-characteristics-1024x663.jpg" className="w-5/6 self-center"/>
              <p className="my-4">There are three major groups of reptiles – lizards and snakes, alligators and crocodiles, and turtles.  Reptiles live all over the world except in frigid locations. They are ectothermic or cold-blooded.  They thrive in warm climates, using the energy from the sun to keep warm.  Reptiles use internal fertilization and lay their eggs on land.  Internal fertilization is the joining of an egg and sperm cell during sexual reproduction, which occurs inside a female’s body.  While still inside the mother’s body, fertilized eggs are covered with membranes and a leathery shell.  This shell, an amniotic egg, helps protect the developing embryo and keeps it from drying out.  Almost all reptiles do not care for their young, abandoning their eggs and leaving the baby reptiles to grow up independently. Crocodiles are the exception.</p>
              <img src="/amniotic-egg-1024x801.jpg" className="w-5/6 self-center"/>
              <p className="my-4">There are thousands of species of lizards scattered around the globe.  Lizards have skin covered with overlapping scales that prevent them from drying out.  They don’t shed their skin whole like snakes do, but rather over time, they lose patches of it as they grow.  In addition, they have a unique adaptation that allows them to regenerate their tail if it’s lost when escaping from a predator.  The tail separates from the body and continues to move, distracting the predator and allowing for a speedy getaway.</p>
              <p className="my-4">Snakes, like lizards, also have dry, scaly skin covered with overlapping scales.  They push themselves on their bellies by moving forward or sideways.  They have flexible muscles in their jaws that allow them to stretch like a rubber band.  This allows the jaw to get wider as it eats.  Additionally, snakes use their bellies to move and can molt or shed their skin several times.  The molting process allows the snake to grow.  They also have kidneys, an organ that filters water from the blood and excretes it as urine.</p>
              <p className="my-4">Unlike lizards and snakes, a turtle’s body is covered by a protective shell that develops from its ribs.  They retreat into the shell when threatened or when they sleep.  Turtles live in or near water and can hold their breath underwater for a very long time.  Turtles eat plants and fish.  Like other reptiles, they lay leathery eggs.  They migrate from feeding areas to nesting grounds, where they dig a hold on a sandy beach and lay their eggs.  Then, they cover them and return to the ocean.  A hatchling must then make its way from the nest to the ocean, a difficult time for a sea turtle.</p>
              <p className="my-4">Both crocodiles and alligators spend most of their lives in water but are adapted to living on land.  They have four legs and a muscular tail for swimming.  They have powerful jaws and large scales, and their eyes and nostrils can be found on top of their heads. The main difference between a crocodile and an alligator is the differences in their snouts.  The crocodile has a long, V-shaped nose, and an alligator has a wide, rounded, u-shaped snout.</p>
              <img src="/birdcharacteristics-1024x663.jpg" className="w-5/6 self-center"/>
              <p className="my-4">Birds, unlike reptiles, are endothermic vertebrates living in diverse environments worldwide. The shapes of their feet, legs, and beaks allow them to thrive and survive in these different places.  For example, the webbed feet of a duck are arranged in a way ideal for swimming.  An ostrich has long, powerful legs that can cover 10 feet in a single stride.  The sharp bill of a gull allows it to snatch its prey, toss it in the air, and then swallow it whole.  A bird’s beak is made of keratin, making it hard, durable, and ideal for pecking holes and eating.</p>
              <p className="my-4">A bird, spending much of its life in the air, requires a tremendous amount of energy.  Birds have an efficient respiratory system with a pair of lungs that move oxygen quickly through their bodies.  Birds have a four-chambered heart that is large and systematic, giving them the stamina they need for their many adaptations for flight.  They have a high-energy diet consisting of insects, seeds, and sometimes other small animals.  A bird has wings with a defined shape, allowing for movement and the surface area needed to fly.  Their bones are hollow, making them light and able to support their wings.  The muscles on their breastbone provide the necessary power and endurance for shorter and longer flights.</p>
              <p>The feathers found on a bird’s wings, and tail are referred to as flight feathers.   Their contour feathers give them a streamlined shape, creating an aerodynamic force that enables flight.  A bird can change the shape of its wing to slow down or speed up.  Down feathers provide insulation and help maintain body temperature.</p>
            </div>
          </div>
        </div>
        <div className="w-1/2 h-screen overflow-y-scroll pr-16 py-12 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Explain</CardTitle>
              <CardDescription>Guiding learners through content</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center space-x-1">
                <Button variant={currentExplainAction === "eli5" ? "default" : "outline"} disabled={!!explainLoading || !selectedText} onClick={() => handleExplainAction("eli5")}>
                  {explainLoading === "eli5" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  ELI5
                </Button> 
                <Button variant={currentExplainAction === "summary" ? "default" : "outline"} disabled={!!explainLoading || !selectedText} onClick={() => handleExplainAction("summary")}>
                  {explainLoading === "summary" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Summarize
                </Button>
                <Button variant={currentExplainAction === "poem" ? "default" : "outline"} disabled={!!explainLoading || !selectedText} onClick={() => handleExplainAction("poem")}>
                  {explainLoading === "poem" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Make a poem
                </Button>
              </div>
              {(explainCompletion || !selectedText) && <div className="w-full text-sm mt-4">
                {explainCompletion && <pre className="whitespace-pre-line">{explainCompletion}</pre>}
                {!selectedText && <span className="italic text-gray-300">👈 Highlight textbook text to perform actions </span>}
              </div>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Translation</CardTitle>
              <CardDescription>Foreign language assistance</CardDescription>
            </CardHeader>
            <CardContent>
              <Input placeholder="e.g. Japanese" value={language} onChange={handleLanguageInputChange}/>
              <div className="flex items-center space-x-1 mt-4">
                <Button variant="outline" disabled={!!translateLoading || translationTTSLoading || !selectedText || !language} onClick={handleTranslate}>
                  {translateLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Translate to {language ? language : "_______"}
                </Button>
                <Button variant="outline" disabled={!!translateLoading || translationTTSLoading || !selectedText || !language} onClick={handleReadTranslation}>
                  {translationTTSLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Read out loud
                </Button>
              </div>
              {(translation || !selectedText) && <div className="w-full text-sm mt-4">
                {translation && <pre className="whitespace-pre-line">{translation}</pre>}
                {!selectedText && <span className="italic text-gray-300">👈 Highlight textbook text to translate</span>}
              </div>}
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>Text to Speech</CardTitle>
              <CardDescription>Using TTS technology to aid the visually impaired</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 mt-1">
                <div className="flex items-center space-x-2 cursor-pointer">
                  <Switch id="tts-mode" checked={ttsMode} onCheckedChange={handleTtsModeChange} />
                  <Label htmlFor="tts-mode">TTS Mode</Label>
                </div>
                {ttsMode && <div className="text-sm italic mt-2">Press <span className="border rounded bg-gray-100 px-1 ">Tab</span> to read sections of the textbook out loud and describe images.</div>}
              </div>

              <hr/>
              <div className="text-sm font-medium mb-2 mt-4">Use GPT-V to describe images</div>
              <div className="flex items-center space-x-1">
                <Button variant="outline" disabled={describeImageIdxLoading !== -1} onClick={() => handleDescribeImageFromIdx(0)}>
                  {describeImageIdxLoading === 0 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Describe Image 1
                </Button>
                <Button variant="outline" disabled={describeImageIdxLoading !== -1} onClick={() => handleDescribeImageFromIdx(1)}>
                  {describeImageIdxLoading === 1 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Describe Image 2
                </Button>
                <Button variant="outline" disabled={describeImageIdxLoading !== -1} onClick={() => handleDescribeImageFromIdx(2)}>
                  {describeImageIdxLoading === 2 && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Describe Image 3
                </Button>
              </div>
              {describeImageText && <Accordion type="single" collapsible defaultValue="img-description">
                <AccordionItem value="img-description" className="border-none">
                  <AccordionTrigger className="text-xs pt-4 text-gray-600">Image description</AccordionTrigger>
                  <AccordionContent>
                    <pre className="w-full text-xs mt-4 whitespace-pre-line">{describeImageText}</pre>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>}
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  )
}
