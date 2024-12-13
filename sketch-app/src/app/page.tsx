"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Eraser, RotateCcw, Lightbulb, CheckCircle2, Pencil, Mic, Square, PlayCircle } from 'lucide-react';
import { Alert, AlertDescription } from "@/components/ui/alert";

const QuestionSketchPad = () => {
  const canvasRef = useRef(null);
  const $forceRef = useRef(null);
  const $touchesRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const drawingActionsRef = useRef([]);
  
  const [isEraser, setIsEraser] = useState(false);
  const [serverResponse, setServerResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [audioChunks, setAudioChunks] = useState([]);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [drawingActions, setDrawingActions] = useState([]);
  const [error, setError] = useState(null);
  const [hasAudioDevice, setHasAudioDevice] = useState(false);

  // Check for audio devices on component mount
  useEffect(() => {
    const checkAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioDevices = devices.filter(device => device.kind === 'audioinput');
        setHasAudioDevice(audioDevices.length > 0);
      } catch (err) {
        console.error('Error checking audio devices:', err);
        setHasAudioDevice(false);
      }
    };

    checkAudioDevices();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    let lineWidth = 0;
    let isMousedown = false;
    let points = [];
    const strokeHistory = [];

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      context.scale(2, 2);
    };
    
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    const getCanvasCoordinates = (clientX, clientY) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: clientX - rect.left,
        y: clientY - rect.top
      };
    };

    const drawOnCanvas = (stroke) => {
      context.lineCap = 'round';
      context.lineJoin = 'round';

      if (isEraser) {
        context.globalCompositeOperation = 'destination-out';
      } else {
        context.globalCompositeOperation = 'source-over';
        context.strokeStyle = 'black';
      }

      const l = stroke.length - 1;
      if (stroke.length >= 3) {
        const xc = (stroke[l].x + stroke[l - 1].x) / 2;
        const yc = (stroke[l].y + stroke[l - 1].y) / 2;
        context.lineWidth = stroke[l - 1].lineWidth;
        context.quadraticCurveTo(stroke[l - 1].x, stroke[l - 1].y, xc, yc);
        context.stroke();
        context.beginPath();
        context.moveTo(xc, yc);
      } else {
        const point = stroke[l];
        context.lineWidth = point.lineWidth;
        context.beginPath();
        context.moveTo(point.x, point.y);
        context.stroke();
      }

      // Record drawing action if recording
      if (isRecording) {
        drawingActionsRef.current.push({
          type: isEraser ? 'erase' : 'draw',
          points: [...stroke],
          timestamp: Date.now()
        });
      }
    };

    const handleStart = (e) => {
      if (e.touches && e.touches[0] && e.touches[0].touchType !== 'stylus') {
        return;
      }

      let pressure = 0.1;
      let coords;
      
      if (e.touches && e.touches[0]) {
        if (e.touches[0].force > 0) {
          pressure = e.touches[0].force;
        }
        coords = getCanvasCoordinates(e.touches[0].clientX, e.touches[0].clientY);
      } else {
        pressure = 1.0;
        coords = getCanvasCoordinates(e.clientX, e.clientY);
      }

      isMousedown = true;
      lineWidth = Math.log(pressure + 1) * 2;
      context.lineWidth = lineWidth;
      points.push({ ...coords, lineWidth });
      drawOnCanvas(points);
    };

    const handleMove = (e) => {
      if (!isMousedown) return;
      
      if (e.touches && e.touches[0] && e.touches[0].touchType !== 'stylus') {
        return;
      }

      e.preventDefault();

      let pressure = 0.1;
      let coords;
      
      if (e.touches && e.touches[0]) {
        if (e.touches[0].force > 0) {
          pressure = e.touches[0].force;
        }
        coords = getCanvasCoordinates(e.touches[0].clientX, e.touches[0].clientY);
      } else {
        pressure = 1.0;
        coords = getCanvasCoordinates(e.clientX, e.clientY);
      }

      lineWidth = (Math.log(pressure + 1) * 10 * 0.2 + lineWidth * 0.8);
      points.push({ ...coords, lineWidth });
      drawOnCanvas(points);

      if ($forceRef.current) {
        $forceRef.current.textContent = 'Force = ' + pressure;
      }

      const touch = e.touches ? e.touches[0] : null;
      // if (touch && $touchesRef.current) {
      //   $touchesRef.current.innerHTML = `
      //     touchType = ${touch.touchType} ${touch.touchType === 'direct' ? '👆' : '✍️'} <br/>
      //     radiusX = ${touch.radiusX} <br/>
      //     radiusY = ${touch.radiusY} <br/>
      //     rotationAngle = ${touch.rotationAngle} <br/>
      //     altitudeAngle = ${touch.altitudeAngle} <br/>
      //     azimuthAngle = ${touch.azimuthAngle} <br/>
      //   `;
      // }
    };

    const handleEnd = () => {
      if (isMousedown) {
        isMousedown = false;
        strokeHistory.push([...points]);
        points = [];
        lineWidth = 0;
      }
    };

    canvas.addEventListener('touchstart', handleStart);
    canvas.addEventListener('mousedown', handleStart);
    canvas.addEventListener('touchmove', handleMove);
    canvas.addEventListener('mousemove', handleMove);
    canvas.addEventListener('touchend', handleEnd);
    canvas.addEventListener('touchleave', handleEnd);
    canvas.addEventListener('mouseup', handleEnd);

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      canvas.removeEventListener('touchstart', handleStart);
      canvas.removeEventListener('mousedown', handleStart);
      canvas.removeEventListener('touchmove', handleMove);
      canvas.removeEventListener('mousemove', handleMove);
      canvas.removeEventListener('touchend', handleEnd);
      canvas.removeEventListener('touchleave', handleEnd);
      canvas.removeEventListener('mouseup', handleEnd);
    };
  }, [isEraser, isRecording]);

  const startRecording = async () => {
    try {
      setError(null); // Clear any previous errors
      
      if (!hasAudioDevice) {
        throw new Error('No microphone found. Please connect a microphone and try again.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false
      });
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      
      // Reset recording data
      setAudioChunks([]);
      drawingActionsRef.current = [];
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setAudioChunks((chunks) => [...chunks, event.data]);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        setRecordedAudio(audioUrl);
        setDrawingActions(drawingActionsRef.current);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      setError(error.message || 'Error starting recording. Please check microphone permissions.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      } catch (err) {
        console.error('Error stopping recording:', err);
        setError('Error stopping recording. Please refresh the page and try again.');
      }
      setIsRecording(false);
    }
  };

  const playRecording = () => {
    if (recordedAudio) {
      const audio = new Audio(recordedAudio);
      audio.play();
      
      // Replay drawing actions
      const startTime = Date.now();
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      // Clear canvas first
      context.clearRect(0, 0, canvas.width, canvas.height);
      
      drawingActions.forEach(action => {
        setTimeout(() => {
          drawOnCanvas(action.points);
        }, action.timestamp - drawingActions[0].timestamp);
      });
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
  };

  const sendCanvasToServer = async (endpoint) => {
    setIsLoading(true);
    try {
      const canvas = canvasRef.current;
      
      // Create a new canvas with white background
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvas.width;
      tempCanvas.height = canvas.height;
      const ctx = tempCanvas.getContext('2d');
      
      // Fill white background
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Draw original canvas content on top
      ctx.drawImage(canvas, 0, 0);
      
      // Get data from temp canvas
      const base64Data = tempCanvas.toDataURL('image/png');
      const blob = await (await fetch(base64Data)).blob();
      
      // Create FormData and append the blob as a file
      const formData = new FormData();
      formData.append('image', blob, 'drawing.png');
      formData.append('text', 'your text here');
      
      const response = await fetch(`http://172.21.53.6:8000/${endpoint}`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      setServerResponse(data.message || 'No response from server');
    } catch (error) {
      setServerResponse(`Error: ${error.message}`);
      console.error('Error:', error);
    }
    setIsLoading(false);
  };


  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 bg-white border-b">
        <h2 className="text-xl font-semibold">Question:</h2>
        <p className="mt-2">
          Solve the following quadratic equation:
          <span className="text-lg font-mono">  9x<sup>4</sup> + 11x<sup>3</sup> - 73 = 0</span>
        </p>
      </div>

      <div className="p-2 bg-white border-b flex gap-2">
        <button 
          onClick={clearCanvas}
          className="p-2 bg-gray-100 rounded hover:bg-gray-200 flex items-center gap-1"
        >
          <RotateCcw size={20} />
          Reset
        </button>
        <button 
          onClick={() => sendCanvasToServer('hint')}
          className="p-2 bg-gray-100 rounded hover:bg-gray-200 flex items-center gap-1"
          disabled={isLoading}
        >
          <Lightbulb size={20} />
          Hint
        </button>
        <button 
          onClick={() => sendCanvasToServer('check')}
          className="p-2 bg-gray-100 rounded hover:bg-gray-200 flex items-center gap-1"
          disabled={isLoading}
        >
          <CheckCircle2 size={20} />
          Check
        </button>
        
        {/* Recording Controls */}
        <div className="ml-auto flex gap-2">
          {!isRecording ? (
            <button
              onClick={startRecording}
              className="p-2 bg-red-100 rounded hover:bg-red-200 flex items-center gap-1"
            >
              <Mic size={20} />
              Record
            </button>
          ) : (
            <button
              onClick={stopRecording}
              className="p-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center gap-1"
            >
              <Square size={20} />
              Stop
            </button>
          )}
          {recordedAudio && (
            <button
              onClick={playRecording}
              className="p-2 bg-green-100 rounded hover:bg-green-200 flex items-center gap-1"
            >
              <PlayCircle size={20} />
              Play
            </button>
          )}
        </div>
      </div>

      <div className="relative bg-gray-50 h-[50vh]">
        <canvas 
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
          style={{ touchAction: 'none' }}
        />
        <div id="force" ref={$forceRef} className="absolute top-2 right-2 text-sm text-gray-600"></div>
        <div id="touches" ref={$touchesRef} className="absolute top-2 left-2 text-sm text-gray-600"></div>
        {isRecording && (
          <div className="absolute top-2 right-2 bg-red-500 text-white px-2 py-1 rounded-full text-sm">
            Recording...
          </div>
        )}
      </div>

      <div className="p-4 bg-white border-t">
        <div className="w-full min-h-[100px] bg-gray-50 rounded p-4">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
            </div>
          ) : (
            <p className="text-gray-700">{serverResponse || 'Response will appear here...'}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default QuestionSketchPad;