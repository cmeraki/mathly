"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Eraser, RotateCcw, Lightbulb, CheckCircle2, Pencil } from 'lucide-react';

const QuestionSketchPad = () => {
  const canvasRef = useRef(null);
  const $forceRef = useRef(null);
  const $touchesRef = useRef(null);
  const [isEraser, setIsEraser] = useState(false);
  const [serverResponse, setServerResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
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
      context.scale(2, 2); // Scale for retina display
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
      if (touch && $touchesRef.current) {
        $touchesRef.current.innerHTML = `
          touchType = ${touch.touchType} ${touch.touchType === 'direct' ? '👆' : '✍️'} <br/>
          radiusX = ${touch.radiusX} <br/>
          radiusY = ${touch.radiusY} <br/>
          rotationAngle = ${touch.rotationAngle} <br/>
          altitudeAngle = ${touch.altitudeAngle} <br/>
          azimuthAngle = ${touch.azimuthAngle} <br/>
        `;
      }
    };

    const handleEnd = () => {
      if (isMousedown) {
        isMousedown = false;
        strokeHistory.push([...points]);
        points = [];
        lineWidth = 0;
      }
    };

    // Add event listeners
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
  }, [isEraser]);

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
      formData.append('text', 'your text here'); // Add any text you want to send
      
      const response = await fetch(`http://172.21.52.155:8000/${endpoint}`, {
        method: 'POST',
        // Don't set Content-Type header - browser will set it automatically with boundary
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
              <span className="text-lg font-mono">  2x<sup>2</sup> + 3x - 5 = 0</span>
          </p>
      </div>

      <div className="p-2 bg-white border-b flex gap-2">
        <button 
          onClick={() => setIsEraser(!isEraser)}
          className={`p-2 rounded flex items-center gap-1 ${
            isEraser ? 'bg-blue-500 text-white' : 'bg-gray-100 hover:bg-gray-200'
          }`}
        >
          {isEraser ? <Eraser size={20} /> : <Pencil size={20} />}
          {isEraser ? 'Eraser' : 'Pen'}
        </button>
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
      </div>

      <div className="relative bg-gray-50 h-[50vh]">
        <canvas 
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full"
          style={{ touchAction: 'none' }}
        />
        <div id="force" ref={$forceRef} className="absolute top-2 right-2 text-sm text-gray-600"></div>
        <div id="touches" ref={$touchesRef} className="absolute top-2 left-2 text-sm text-gray-600"></div>
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